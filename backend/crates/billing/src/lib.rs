//! Provider-independent subscription, invoice, and payment domain contracts.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Trialing,
    PendingPayment,
    Active,
    PastDue,
    GracePeriod,
    Canceled,
    Expired,
    Paused,
}

impl SubscriptionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Trialing => "trialing",
            Self::PendingPayment => "pending_payment",
            Self::Active => "active",
            Self::PastDue => "past_due",
            Self::GracePeriod => "grace_period",
            Self::Canceled => "canceled",
            Self::Expired => "expired",
            Self::Paused => "paused",
        }
    }
    pub fn can_transition(self, next: Self) -> bool {
        use SubscriptionStatus::*;
        self == next
            || matches!(
                (self, next),
                (Trialing, Active | Canceled | Expired | PastDue)
                    | (PendingPayment, Active | Canceled | Expired)
                    | (Active, PastDue | GracePeriod | Canceled | Expired | Paused)
                    | (PastDue, Active | GracePeriod | Canceled | Expired)
                    | (GracePeriod, Active | Canceled | Expired)
                    | (Canceled, Active | Expired)
                    | (Expired, Active)
                    | (Paused, Active | Canceled | Expired)
            )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub currency: String,
    pub amount_minor: i64,
}
impl Money {
    pub fn new(currency: impl Into<String>, amount_minor: i64) -> Result<Self, BillingError> {
        let currency = currency.into().to_ascii_uppercase();
        if currency.len() != 3 || !currency.bytes().all(|b| b.is_ascii_uppercase()) {
            return Err(BillingError::InvalidCurrency);
        }
        if amount_minor < 0 {
            return Err(BillingError::NegativeAmount);
        }
        Ok(Self {
            currency,
            amount_minor,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub description: String,
    pub quantity: i64,
    pub unit_amount_minor: i64,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceTotals {
    pub subtotal_minor: i64,
    pub tax_minor: i64,
    pub total_minor: i64,
    currency: String,
}

/// Tax is represented in integer basis points. All intermediate arithmetic uses i128.
pub fn calculate_invoice(
    lines: &[InvoiceLine],
    currency: &str,
    tax_basis_points: i32,
) -> Result<InvoiceTotals, BillingError> {
    Money::new(currency, 0)?;
    if !(0..=100_000).contains(&tax_basis_points) {
        return Err(BillingError::InvalidTaxRate);
    }
    let subtotal = lines.iter().try_fold(0_i128, |sum, line| {
        if line.quantity <= 0 || line.unit_amount_minor < 0 {
            return Err(BillingError::NegativeAmount);
        }
        sum.checked_add(i128::from(line.quantity) * i128::from(line.unit_amount_minor))
            .ok_or(BillingError::Overflow)
    })?;
    let tax = (subtotal * i128::from(tax_basis_points) + 5_000) / 10_000;
    let total = subtotal.checked_add(tax).ok_or(BillingError::Overflow)?;
    Ok(InvoiceTotals {
        subtotal_minor: i64::try_from(subtotal).map_err(|_| BillingError::Overflow)?,
        tax_minor: i64::try_from(tax).map_err(|_| BillingError::Overflow)?,
        total_minor: i64::try_from(total).map_err(|_| BillingError::Overflow)?,
        currency: currency.to_ascii_uppercase(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDraft {
    pub organization_id: Uuid,
    pub subscription_id: Option<Uuid>,
    pub currency: String,
    pub lines: Vec<InvoiceLine>,
    pub tax_basis_points: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayCheckout {
    pub provider_id: String,
    pub external_reference: Option<String>,
    pub redirect_url: Option<String>,
    pub instructions: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedGatewayEvent {
    pub event_id: String,
    pub event_type: String,
    pub invoice_reference: String,
    pub occurred_at: DateTime<Utc>,
    pub payload: Value,
}

#[derive(Debug, thiserror::Error)]
pub enum GatewayError {
    #[error("payment provider is disabled")]
    Disabled,
    #[error("payment provider does not support this operation")]
    Unsupported,
    #[error("webhook signature is invalid")]
    InvalidSignature,
    #[error("provider request failed: {0}")]
    Request(String),
}

/// Implementations must never treat browser return URLs as proof of payment.
#[async_trait::async_trait]
pub trait PaymentGateway: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn supports_recurring(&self) -> bool;
    async fn begin_payment(
        &self,
        invoice_id: Uuid,
        invoice: &InvoiceDraft,
    ) -> Result<GatewayCheckout, GatewayError>;
    fn verify_webhook(
        &self,
        headers: &[(String, String)],
        body: &[u8],
    ) -> Result<VerifiedGatewayEvent, GatewayError>;
}

/// Safe fallback when no processor has been approved. It creates invoice payment
/// instructions and deliberately has no webhook or automatic-renewal behavior.
pub struct ManualInvoiceGateway {
    pub instructions: String,
}
#[async_trait::async_trait]
impl PaymentGateway for ManualInvoiceGateway {
    fn provider_id(&self) -> &'static str {
        "manual_invoice"
    }
    fn supports_recurring(&self) -> bool {
        false
    }
    async fn begin_payment(
        &self,
        invoice_id: Uuid,
        _: &InvoiceDraft,
    ) -> Result<GatewayCheckout, GatewayError> {
        Ok(GatewayCheckout {
            provider_id: self.provider_id().into(),
            external_reference: Some(invoice_id.to_string()),
            redirect_url: None,
            instructions: Some(self.instructions.clone()),
        })
    }
    fn verify_webhook(
        &self,
        _: &[(String, String)],
        _: &[u8],
    ) -> Result<VerifiedGatewayEvent, GatewayError> {
        Err(GatewayError::Unsupported)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BillingError {
    #[error("invalid currency code")]
    InvalidCurrency,
    #[error("amount or quantity cannot be negative or zero")]
    NegativeAmount,
    #[error("invalid tax basis point rate")]
    InvalidTaxRate,
    #[error("money calculation overflow")]
    Overflow,
    #[error("invalid subscription state transition")]
    InvalidTransition,
}

pub fn validate_transition(
    current: SubscriptionStatus,
    next: SubscriptionStatus,
) -> Result<(), BillingError> {
    if current.can_transition(next) {
        Ok(())
    } else {
        Err(BillingError::InvalidTransition)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invoice_uses_minor_units_and_rounds_tax() {
        let lines = vec![InvoiceLine {
            description: "Plan".into(),
            quantity: 1,
            unit_amount_minor: 1900,
        }];
        let result = calculate_invoice(&lines, "usd", 875).unwrap();
        assert_eq!(
            (result.subtotal_minor, result.tax_minor, result.total_minor),
            (1900, 166, 2066)
        );
    }
    #[test]
    fn invalid_and_out_of_order_state_transitions_are_rejected() {
        assert!(
            validate_transition(
                SubscriptionStatus::PendingPayment,
                SubscriptionStatus::Active
            )
            .is_ok()
        );
        assert!(
            validate_transition(SubscriptionStatus::Expired, SubscriptionStatus::PastDue).is_err()
        );
    }
    #[test]
    fn money_rejects_negative_amounts_and_bad_currency() {
        assert!(Money::new("NPR", 100).is_ok());
        assert!(Money::new("US", 100).is_err());
        assert!(Money::new("USD", -1).is_err());
    }

    #[test]
    fn subscription_transition_matrix_is_explicit() {
        use SubscriptionStatus::*;
        let valid = [
            (Trialing, Active),
            (Trialing, Canceled),
            (PendingPayment, Active),
            (PendingPayment, Expired),
            (Active, PastDue),
            (Active, GracePeriod),
            (Active, Canceled),
            (PastDue, Active),
            (PastDue, GracePeriod),
            (GracePeriod, Expired),
            (Canceled, Active),
            (Expired, Active),
            (Paused, Canceled),
        ];
        for (from, to) in valid {
            assert!(validate_transition(from, to).is_ok(), "{from:?} -> {to:?}");
        }

        let invalid = [
            (PendingPayment, GracePeriod),
            (Expired, PastDue),
            (Canceled, PastDue),
            (Paused, PendingPayment),
        ];
        for (from, to) in invalid {
            assert!(validate_transition(from, to).is_err(), "{from:?} -> {to:?}");
        }
    }

    #[test]
    fn invoice_rejects_invalid_quantities_and_overflow() {
        assert!(
            calculate_invoice(
                &[InvoiceLine {
                    description: "invalid".into(),
                    quantity: 0,
                    unit_amount_minor: 100,
                }],
                "USD",
                0,
            )
            .is_err()
        );
        assert!(
            calculate_invoice(
                &[InvoiceLine {
                    description: "too large".into(),
                    quantity: i64::MAX,
                    unit_amount_minor: i64::MAX,
                }],
                "USD",
                0,
            )
            .is_err()
        );
    }
}
