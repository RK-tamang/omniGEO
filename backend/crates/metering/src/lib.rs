//! Integer credit accounting helpers. Persistence is append-only and transactional.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReservationState {
    Reserved,
    Settled,
    Released,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CreditReservation {
    pub reserved: i64,
    pub state: ReservationState,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MeteringError {
    #[error("credit amount must be positive")]
    InvalidAmount,
    #[error("insufficient available credits")]
    InsufficientCredits,
    #[error("reservation is no longer open")]
    AlreadyClosed,
}

pub fn reserve(balance: i64, amount: i64) -> Result<(i64, CreditReservation), MeteringError> {
    if amount <= 0 {
        return Err(MeteringError::InvalidAmount);
    }
    if balance < amount {
        return Err(MeteringError::InsufficientCredits);
    }
    Ok((
        balance - amount,
        CreditReservation {
            reserved: amount,
            state: ReservationState::Reserved,
        },
    ))
}

pub fn settle(
    balance: i64,
    reservation: CreditReservation,
    actual: i64,
) -> Result<(i64, i64), MeteringError> {
    if reservation.state != ReservationState::Reserved {
        return Err(MeteringError::AlreadyClosed);
    }
    if actual < 0 {
        return Err(MeteringError::InvalidAmount);
    }
    if actual > reservation.reserved && balance < actual - reservation.reserved {
        return Err(MeteringError::InsufficientCredits);
    }
    let next = if actual < reservation.reserved {
        balance.saturating_add(reservation.reserved - actual)
    } else {
        balance - (actual - reservation.reserved)
    };
    Ok((next, actual))
}

pub fn release(balance: i64, reservation: CreditReservation) -> Result<i64, MeteringError> {
    if reservation.state != ReservationState::Reserved {
        return Err(MeteringError::AlreadyClosed);
    }
    Ok(balance.saturating_add(reservation.reserved))
}
