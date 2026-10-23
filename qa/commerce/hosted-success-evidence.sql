-- Read-only hosted success evidence gate. Run in isolated project ONLY:
-- ufqjgyzspavamdpkdxmc (success-wishes-test-20261022).
--
-- Distinguishes matching sandbox provider-success evidence from the
-- preloaded synthetic fixture. Does not initiate charges or grant access.
-- A database result alone cannot prove provider provenance if a privileged
-- operator inserted forged data; confirm protected writers and Daraja logs.
-- Checkout IDs include both numeric and DMZ-style formats from Safaricom.
WITH candidate AS (
 SELECT
  o.id AS order_id,
  o.state AS order_state,
  o.amount_kes,
  a.id AS attempt_id,
  a.state AS attempt_state,
  a.checkout_request_id,
  (a.provider_receipt IS NOT NULL) AS receipt_recorded,
  (a.checkout_request_id ~ '^ws_CO_[A-Za-z0-9_:-]{12,}$'
    AND a.checkout_request_id NOT ILIKE '%synthetic%'
    AND a.checkout_request_id NOT ILIKE '%fixture%') AS provider_shaped_checkout,
  (SELECT count(*) FROM commerce_sandbox.provider_inbox cb
    WHERE cb.checkout_request_id = a.checkout_request_id
      AND cb.merchant_request_id = a.merchant_request_id
      AND cb.result_code = 0 AND cb.paid_amount_kes = 50
      AND cb.phone = a.phone
      AND cb.provider_receipt = a.provider_receipt
      AND cb.provider_receipt ~ '^[A-Za-z0-9]{6,30}$') AS matching_success_callbacks,
  (SELECT count(*) FROM commerce_sandbox.provider_query_observations pq
    WHERE pq.checkout_request_id = a.checkout_request_id
      AND pq.merchant_request_id = a.merchant_request_id
      AND pq.result_code = 0) AS successful_provider_queries,
  (SELECT count(*) FROM commerce_sandbox.simulated_entitlements g
    WHERE g.order_id = o.id AND g.attempt_id = a.id
      AND g.mode = 'sandbox') AS matching_simulated_grants
 FROM commerce_sandbox.orders o
 JOIN commerce_sandbox.payment_attempts a ON a.order_id = o.id
 WHERE o.product_kind = 'success_wish'
   AND o.item_reference = 'sandbox-success-wish'
)
SELECT
 order_id, attempt_id, checkout_request_id, amount_kes,
 order_state, attempt_state, receipt_recorded,
 matching_success_callbacks, successful_provider_queries,
 matching_simulated_grants,
 CASE
  WHEN order_state = 'settled_simulated'
   AND attempt_state = 'settled_simulated'
   AND amount_kes = 50
   AND provider_shaped_checkout
   AND receipt_recorded
   AND matching_success_callbacks = 1
   AND successful_provider_queries >= 1
   AND matching_simulated_grants = 1
  THEN 'verified_sandbox_success_evidence'
  WHEN NOT provider_shaped_checkout THEN 'synthetic_or_nonprovider_fixture'
  WHEN attempt_state IN ('expired','failed','cancelled') THEN 'provider_payment_unsuccessful'
  ELSE 'not_yet_verified'
 END AS evidence_verdict
FROM candidate ORDER BY order_id;
