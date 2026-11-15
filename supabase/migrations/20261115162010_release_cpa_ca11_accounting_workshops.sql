-- CA11 Applied Accounting Workshops 02B: release five separate case-workshop lessons.
-- Source: KASNEB June 2024 Financial Accounting syllabus, section 2.1-2.5.
-- The core unit already published three topics and 14 questions; original Unit 01
-- has three lessons and 12 questions. This mutation preserves all six prior topics.
-- Commission after exact-head CI, published content QA and verified production compatibility.
begin;
do $release_workshops$
declare
 v_course public.courses%rowtype;v_module uuid;
 v_prev int;v_intro int;v_core int;v_review int;v_total int;
 v_questions int;v_prevquestions int;v_wrong int;v_unknown int;v_other int;v_changed int;
begin
 select * into v_course from public.courses
 where slug='kasneb-cpa' and status='live' and qualification_code='CPA'
  and qualifying_body='KASNEB' and syllabus_source_url like 'https://www.kasneb.or.ke/%';
 if not found then raise exception 'CA11 workshop release needs a verified KASNEB CPA course'; end if;
 select m.id into strict v_module from public.modules m
 where m.course_id=v_course.id and m.slug='ca11' and m.qualification_level='Foundation'
 and m.qualification_requirement='required' for update;

 select count(*) into v_intro from public.topics
 where module_id=v_module and content_status='published'
  and (slug,sequence_number) in (
   ('why-accounts-matter',1),('five-elements-of-financial-statements',2),('the-equation-in-action',3)
  );
 select count(*) into v_core from public.topics
 where module_id=v_module and content_status='published'
  and (slug,sequence_number) in (
   ('source-documents-and-books',4),('double-entry-and-ledgers',5),('trial-balance-and-statements',6)
  );
 if v_intro<>3 or v_core<>3 then raise exception 'Six previously published CA11 lessons are required'; end if;
 select count(*) into v_prev from public.topics where module_id=v_module and content_status='published';
 if v_prev<>6 then raise exception 'Unexpected prior published topic inventory %',v_prev; end if;
 select count(*) into v_prevquestions from public.quiz_questions q
 join public.topics t on t.id=q.topic_id where t.module_id=v_module and t.sequence_number<=6;
 if v_prevquestions<>26 then raise exception 'Prior CA11 question authority drifted: %',v_prevquestions; end if;

 select count(*) into v_review from public.topics t
 where t.module_id=v_module and t.content_status='in_review'
  and t.sequence_number between 7 and 11
  and t.slug in ('source-documents-and-evidence','books-of-original-entry','double-entry-ledgers','trial-balance-from-ledgers','statements-from-the-trial-balance')
  and jsonb_array_length(t.concept_tab)>=7
  and jsonb_array_length(t.kenya_context_tab)>=2
  and jsonb_array_length(t.common_errors_tab)>=2
  and jsonb_array_length(t.clinical_tip_tab)>=1;
 if v_review<>5 then raise exception 'Five applied workshop lessons not review-ready: %',v_review; end if;
 select count(*) into v_total from public.topics where module_id=v_module;
 if v_total<>11 then raise exception 'Unexpected concurrently staged content: %',v_total; end if;
 if exists(select 1 from public.topics t join public.modules m on m.id=t.module_id
  where m.course_id=v_course.id and m.id<>v_module)
 then raise exception 'Another CPA paper has unexpected content'; end if;

 select count(*) into v_questions from public.quiz_questions q
 join public.topics t on t.id=q.topic_id
 where t.module_id=v_module and t.slug in ('source-documents-and-evidence','books-of-original-entry','double-entry-ledgers','trial-balance-from-ledgers','statements-from-the-trial-balance');
 if v_questions<>30 then raise exception 'Expected 30 distinct applied questions, received %',v_questions; end if;
 with expected(topic_slug,question_text,correct_option_id) as (values
    ('source-documents-and-evidence','A workshop invoices a customer KSh 24,000 for work completed on credit. What is supported immediately by the invoice, under the stated recognition assumptions?','b'),
    ('source-documents-and-evidence','A client pays KSh 6,000 against a previously recorded KSh 16,000 credit invoice. With no other movements, how much does the client still owe?','c'),
    ('source-documents-and-evidence','Goods sold on credit for KSh 24,000 are partly returned, and the seller issues a valid KSh 3,000 credit note. No payments have been made. What remains receivable?','d'),
    ('source-documents-and-evidence','Which document most directly supports the fact that a customer settled an earlier invoice by bank transfer?','a'),
    ('source-documents-and-evidence','A business pays the owner''s private grocery bill from the business bank account. Which classification ordinarily fits a sole trader?','c'),
    ('source-documents-and-evidence','When a customer disputes an invoice, which evidence trail gives the accountant the clearest way to investigate the recorded transaction?','d'),
    ('books-of-original-entry','Under the traditional trading-business classification, which transaction belongs in a sales day book?','b'),
    ('books-of-original-entry','A retailer acquires a delivery machine costing KSh 30,000 on supplier credit. What is the appropriate underlying general-journal entry?','c'),
    ('books-of-original-entry','A business transfers KSh 4,500 from its bank to settle an electricity bill. Which first recording path is most suitable in a manual system?','a'),
    ('books-of-original-entry','Petty cash starts at KSh 5,000. Vouchers total KSh 1,250, KSh 700 and KSh 850. What replenishment restores the float?','d'),
    ('books-of-original-entry','A shop issues a KSh 2,000 credit note for goods a customer returns from an earlier credit sale. Which specialised record is normally relevant?','b'),
    ('books-of-original-entry','An integrated accounting app posts ledger updates when an invoice is accepted. What remains the accountant''s responsibility?','c'),
    ('double-entry-ledgers','A sole trader introduces KSh 180,000 into the business bank account. Which entry is correct?','b'),
    ('double-entry-ledgers','The business buys equipment for KSh 60,000 by bank transfer. Which entry follows?','a'),
    ('double-entry-ledgers','Nuru Repair Studio completes KSh 35,000 of repairs on credit. Which accounts are affected at initial recognition?','d'),
    ('double-entry-ledgers','The bank starts with KSh 180,000, then movements are −60,000, +45,000, −12,000, +20,000, −5,000 and −4,000. What is the closing bank balance?','c'),
    ('double-entry-ledgers','Advertising services worth KSh 8,000 are used on credit, then KSh 5,000 is paid to the supplier. What remains payable?','b'),
    ('double-entry-ledgers','A potential customer asks for a price quotation for future repairs; no work has been done and no binding transaction is assumed. Which posting is justified?','d'),
    ('trial-balance-from-ledgers','The trial balance lists debit balances of KSh 164,000 bank, 60,000 equipment, 15,000 receivables, 12,000 rent, 8,000 advertising and 4,000 drawings. What is the debit total?','a'),
    ('trial-balance-from-ledgers','The same trial balance lists credit balances of KSh 180,000 capital, KSh 80,000 revenue and KSh 3,000 payables. What is the credit total?','c'),
    ('trial-balance-from-ledgers','The bank ledger has KSh 245,000 of debit movements and KSh 81,000 of credit movements. Which figure enters a basic trial balance?','d'),
    ('trial-balance-from-ledgers','A KSh 5,000 payment to a creditor is accidentally omitted from both the bank and payable ledgers. What may happen to the trial balance?','b'),
    ('trial-balance-from-ledgers','The debit trial-balance column totals KSh 263,000 and the credit column KSh 268,000. What should the accountant do?','a'),
    ('trial-balance-from-ledgers','Credit repairs of KSh 35,000 are followed by a customer payment of KSh 20,000. What receivable balance enters the trial balance?','c'),
    ('statements-from-the-trial-balance','Nuru Repair Studio earns KSh 80,000 revenue and incurs KSh 12,000 rent plus KSh 8,000 advertising expense. What is the period''s profit?','b'),
    ('statements-from-the-trial-balance','Closing assets are bank KSh 164,000, equipment KSh 60,000 and receivables KSh 15,000. What is total assets?','a'),
    ('statements-from-the-trial-balance','The owner introduced KSh 180,000, the business earned KSh 60,000 and the owner withdrew KSh 4,000. What is closing equity?','d'),
    ('statements-from-the-trial-balance','With assets of KSh 239,000 and equity of KSh 236,000, what is the outstanding liability?','c'),
    ('statements-from-the-trial-balance','Why is KSh 164,000 bank cash not equal to the KSh 60,000 accounting profit?','b'),
    ('statements-from-the-trial-balance','What is the correct professional description of the teaching statements prepared from this simplified trial balance?','a')
 ), actual as (
   select t.slug,q.question_text,q.correct_option_id,q.options,q.explanation
   from public.quiz_questions q join public.topics t on t.id=q.topic_id
   where t.module_id=v_module and t.slug in ('source-documents-and-evidence','books-of-original-entry','double-entry-ledgers','trial-balance-from-ledgers','statements-from-the-trial-balance')
 )
 select count(*) into v_wrong from expected e
 left join actual a on a.slug=e.topic_slug and a.question_text=e.question_text
 where a.correct_option_id is distinct from e.correct_option_id
  or jsonb_typeof(a.options) is distinct from 'array'
  or jsonb_array_length(coalesce(a.options,'[]'::jsonb))<>4
  or not exists(select 1 from jsonb_array_elements(coalesce(a.options,'[]'::jsonb)) opt where opt->>'id'=e.correct_option_id)
  or length(btrim(coalesce(a.explanation,'')))<75;
 if v_wrong<>0 then raise exception 'Expected question text, answer key or feedback mismatch: %',v_wrong; end if;
 if exists(
   select 1 from public.quiz_questions q
   join public.topics t on t.id=q.topic_id
   where t.module_id=v_module and t.slug in ('source-documents-and-evidence','books-of-original-entry','double-entry-ledgers','trial-balance-from-ledgers','statements-from-the-trial-balance')
   and q.question_text not in (
     'A workshop invoices a customer KSh 24,000 for work completed on credit. What is supported immediately by the invoice, under the stated recognition assumptions?','A client pays KSh 6,000 against a previously recorded KSh 16,000 credit invoice. With no other movements, how much does the client still owe?','Goods sold on credit for KSh 24,000 are partly returned, and the seller issues a valid KSh 3,000 credit note. No payments have been made. What remains receivable?','Which document most directly supports the fact that a customer settled an earlier invoice by bank transfer?','A business pays the owner''s private grocery bill from the business bank account. Which classification ordinarily fits a sole trader?','When a customer disputes an invoice, which evidence trail gives the accountant the clearest way to investigate the recorded transaction?','Under the traditional trading-business classification, which transaction belongs in a sales day book?','A retailer acquires a delivery machine costing KSh 30,000 on supplier credit. What is the appropriate underlying general-journal entry?','A business transfers KSh 4,500 from its bank to settle an electricity bill. Which first recording path is most suitable in a manual system?','Petty cash starts at KSh 5,000. Vouchers total KSh 1,250, KSh 700 and KSh 850. What replenishment restores the float?','A shop issues a KSh 2,000 credit note for goods a customer returns from an earlier credit sale. Which specialised record is normally relevant?','An integrated accounting app posts ledger updates when an invoice is accepted. What remains the accountant''s responsibility?','A sole trader introduces KSh 180,000 into the business bank account. Which entry is correct?','The business buys equipment for KSh 60,000 by bank transfer. Which entry follows?','Nuru Repair Studio completes KSh 35,000 of repairs on credit. Which accounts are affected at initial recognition?','The bank starts with KSh 180,000, then movements are −60,000, +45,000, −12,000, +20,000, −5,000 and −4,000. What is the closing bank balance?','Advertising services worth KSh 8,000 are used on credit, then KSh 5,000 is paid to the supplier. What remains payable?','A potential customer asks for a price quotation for future repairs; no work has been done and no binding transaction is assumed. Which posting is justified?','The trial balance lists debit balances of KSh 164,000 bank, 60,000 equipment, 15,000 receivables, 12,000 rent, 8,000 advertising and 4,000 drawings. What is the debit total?','The same trial balance lists credit balances of KSh 180,000 capital, KSh 80,000 revenue and KSh 3,000 payables. What is the credit total?','The bank ledger has KSh 245,000 of debit movements and KSh 81,000 of credit movements. Which figure enters a basic trial balance?','A KSh 5,000 payment to a creditor is accidentally omitted from both the bank and payable ledgers. What may happen to the trial balance?','The debit trial-balance column totals KSh 263,000 and the credit column KSh 268,000. What should the accountant do?','Credit repairs of KSh 35,000 are followed by a customer payment of KSh 20,000. What receivable balance enters the trial balance?','Nuru Repair Studio earns KSh 80,000 revenue and incurs KSh 12,000 rent plus KSh 8,000 advertising expense. What is the period''s profit?','Closing assets are bank KSh 164,000, equipment KSh 60,000 and receivables KSh 15,000. What is total assets?','The owner introduced KSh 180,000, the business earned KSh 60,000 and the owner withdrew KSh 4,000. What is closing equity?','With assets of KSh 239,000 and equity of KSh 236,000, what is the outstanding liability?','Why is KSh 164,000 bank cash not equal to the KSh 60,000 accounting profit?','What is the correct professional description of the teaching statements prepared from this simplified trial balance?'
   )
 ) then raise exception 'Unexpected workshop question injected'; end if;

 update public.topics set content_status='published'
 where module_id=v_module and content_status='in_review'
  and slug in ('source-documents-and-evidence','books-of-original-entry','double-entry-ledgers','trial-balance-from-ledgers','statements-from-the-trial-balance') and sequence_number between 7 and 11;
 get diagnostics v_changed=ROW_COUNT;
 if v_changed<>5 then raise exception 'Workshop release changed %, expected 5',v_changed; end if;
 if (select count(*) from public.topics where module_id=v_module and content_status='published')<>11
 then raise exception 'Expected 11 published CA11 topics after workshop release'; end if;
 if (select count(*) from public.quiz_questions q join public.topics t on t.id=q.topic_id
  where t.module_id=v_module)<>56 then raise exception 'Expected 56 CA11 practice questions after release'; end if;
end $release_workshops$;
commit;
