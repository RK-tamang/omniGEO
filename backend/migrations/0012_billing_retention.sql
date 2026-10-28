-- Billing history follows its owning organization during account deletion.
-- Keep payment and refund rows consistent when invoices are removed.
ALTER TABLE payments DROP CONSTRAINT payments_invoice_id_fkey;
ALTER TABLE payments
    ADD CONSTRAINT payments_invoice_id_fkey
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE refunds DROP CONSTRAINT refunds_payment_id_fkey;
ALTER TABLE refunds
    ADD CONSTRAINT refunds_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
