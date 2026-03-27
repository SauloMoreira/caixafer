
DELETE FROM daily_operation_insights WHERE business_date = CURRENT_DATE;
DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE business_date = CURRENT_DATE);
DELETE FROM sales WHERE business_date = CURRENT_DATE;
DELETE FROM cash_entries WHERE business_date = CURRENT_DATE;
DELETE FROM cash_session_transfers WHERE business_date = CURRENT_DATE;
DELETE FROM cash_closings WHERE business_date = CURRENT_DATE;
