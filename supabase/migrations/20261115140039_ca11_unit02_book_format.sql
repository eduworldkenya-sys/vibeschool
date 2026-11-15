-- Reflow the existing published CA11 Unit 02 content into canonical chapter blocks.
-- No new topics, question changes, access changes, or progress changes.
do $ca11_book$
declare
  v_chapters constant jsonb := $chapters$
{
  "source-documents-and-books": [
    {
      "id": "the-invoice",
      "title": "The customer says she paid",
      "text": "On Wednesday morning, a customer calls Nuru Print Studio. “I sent the money yesterday. Can you confirm?” The owner pulls out invoice F01 for KSh 9,000. It tells her what the studio charged for the job. She still needs the receipt and bank record to confirm what the customer paid.\n\nThe bank record shows KSh 6,000 under reference B02. She matches it to receipt R01 and invoice F01. The three documents tell one story: the studio earned KSh 9,000, collected KSh 6,000, and is still owed KSh 3,000. Recording another sale when the payment comes in would count part of the same job twice.",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "On Wednesday morning, a customer calls Nuru Print Studio. “I sent the money yesterday. Can you confirm?” The owner pulls out invoice F01 for KSh 9,000. It tells her what the studio charged for the job. She still needs the receipt and bank record to confirm what the customer paid."
        },
        {
          "kind": "paragraph",
          "text": "The bank record shows KSh 6,000 under reference B02. She matches it to receipt R01 and invoice F01. The three documents tell one story: the studio earned KSh 9,000, collected KSh 6,000, and is still owed KSh 3,000. Recording another sale when the payment comes in would count part of the same job twice."
        }
      ]
    },
    {
      "id": "the-first-record",
      "title": "Where the paperwork goes",
      "text": "Start with the date, reference, parties, amount and reason for the transaction. Check whether money moved or is still due. If you cannot match the document to the transaction, ask for the missing record before posting.\n\nA shop enters credit sales of goods in its sales journal and credit purchases of goods for resale in its purchases journal. An invoice for KSh 4,000 of exercise books for resale goes in the purchases journal. A printer bought on credit for the shop’s own use goes in the general journal. Its equipment register separately tracks what the shop bought, its cost and where it is kept.\n\nNuru uses its fee-invoice register as the original entry for jobs billed on credit. The cashbook records bank and cash movements. The petty cash book records small payments from a separate float, supported by vouchers.",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Start with the date, reference, parties, amount and reason for the transaction. Check whether money moved or is still due. If you cannot match the document to the transaction, ask for the missing record before posting."
        },
        {
          "kind": "paragraph",
          "text": "A shop enters credit sales of goods in its sales journal and credit purchases of goods for resale in its purchases journal. An invoice for KSh 4,000 of exercise books for resale goes in the purchases journal. A printer bought on credit for the shop’s own use goes in the general journal. Its equipment register separately tracks what the shop bought, its cost and where it is kept."
        },
        {
          "kind": "paragraph",
          "text": "Nuru uses its fee-invoice register as the original entry for jobs billed on credit. The cashbook records bank and cash movements. The petty cash book records small payments from a separate float, supported by vouchers."
        }
      ]
    },
    {
      "id": "opening-week",
      "title": "Nuru’s first week",
      "text": "Nuru is a sole trader with no opening balances. All jobs mentioned are complete. Set taxes, depreciation and other adjustments aside for this example.\n\nOn Monday the owner puts KSh 30,000 into the business bank account (B01). The cashbook records the receipt. A KSh 12,000 printer arrives on credit the same day (P17). The purchase goes into the general journal and the printer is listed in the equipment register.\n\nOn Tuesday the studio bills KSh 9,000 for the job (F01). The fee-invoice register carries the charge. Wednesday’s KSh 6,000 collection (R01/B02) goes into the bank receipts column of the cashbook.\n\nOn Thursday the studio pays KSh 4,000 to the printer supplier (B03), then transfers KSh 2,000 from bank to petty cash (B04). The transfer is a bank payment and a petty-cash receipt. The same reference links both records. On Friday, a KSh 500 delivery payment goes into the petty cash book (V01).",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Nuru is a sole trader with no opening balances. All jobs mentioned are complete. Set taxes, depreciation and other adjustments aside for this example."
        },
        {
          "kind": "paragraph",
          "text": "On Monday the owner puts KSh 30,000 into the business bank account (B01). The cashbook records the receipt. A KSh 12,000 printer arrives on credit the same day (P17). The purchase goes into the general journal and the printer is listed in the equipment register."
        },
        {
          "kind": "paragraph",
          "text": "On Tuesday the studio bills KSh 9,000 for the job (F01). The fee-invoice register carries the charge. Wednesday’s KSh 6,000 collection (R01/B02) goes into the bank receipts column of the cashbook."
        },
        {
          "kind": "paragraph",
          "text": "On Thursday the studio pays KSh 4,000 to the printer supplier (B03), then transfers KSh 2,000 from bank to petty cash (B04). The transfer is a bank payment and a petty-cash receipt. The same reference links both records. On Friday, a KSh 500 delivery payment goes into the petty cash book (V01)."
        }
      ]
    }
  ],
  "double-entry-and-ledgers": [
    {
      "id": "post-the-accounts",
      "title": "Give each transaction two sides",
      "text": "Before you write Dr or Cr, ask what changed. Assets and expenses increase with a debit. Liabilities, owner’s capital and revenue increase with a credit. To record a decrease, use the other side.\n\nTake invoice F01. The customer now owes the studio KSh 9,000, so debit Trade receivables. The completed job earns that amount, so credit Service fees. When the bank receives KSh 6,000, debit Bank and credit Trade receivables, reducing the customer’s balance to KSh 3,000.\n\nNow look at payment B03. The studio owes its printer supplier less, so debit the Equipment supplier payable account. It also has less money in the bank, so credit Bank. The two sides of the KSh 2,000 float transfer likewise belong to one entry.\n\nIn a manual system where the cashbook already serves as the Bank ledger, post the opposite side to the other account without entering the bank side a second time.\n\nNuru’s posting record · KSh\nRef · Debit account · Credit account · Amount\nB01 · Bank · Capital · 30,000\nP17 · Equipment · Equipment supplier payable · 12,000\nF01 · Trade receivables · Service fees · 9,000\nR01/B02 · Bank · Trade receivables · 6,000\nB03 · Equipment supplier payable · Bank · 4,000\nB04 · Petty cash · Bank · 2,000\nV01 · Delivery expense · Petty cash · 500",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Before you write Dr or Cr, ask what changed. Assets and expenses increase with a debit. Liabilities, owner’s capital and revenue increase with a credit. To record a decrease, use the other side."
        },
        {
          "kind": "paragraph",
          "text": "Take invoice F01. The customer now owes the studio KSh 9,000, so debit Trade receivables. The completed job earns that amount, so credit Service fees. When the bank receives KSh 6,000, debit Bank and credit Trade receivables, reducing the customer’s balance to KSh 3,000."
        },
        {
          "kind": "paragraph",
          "text": "Now look at payment B03. The studio owes its printer supplier less, so debit the Equipment supplier payable account. It also has less money in the bank, so credit Bank. The two sides of the KSh 2,000 float transfer likewise belong to one entry."
        },
        {
          "kind": "paragraph",
          "text": "In a manual system where the cashbook already serves as the Bank ledger, post the opposite side to the other account without entering the bank side a second time."
        },
        {
          "kind": "table",
          "caption": "Nuru’s posting record · KSh",
          "columns": [
            "Ref",
            "Debit account",
            "Credit account",
            "Amount"
          ],
          "rows": [
            [
              "B01",
              "Bank",
              "Capital",
              "30,000"
            ],
            [
              "P17",
              "Equipment",
              "Equipment supplier payable",
              "12,000"
            ],
            [
              "F01",
              "Trade receivables",
              "Service fees",
              "9,000"
            ],
            [
              "R01/B02",
              "Bank",
              "Trade receivables",
              "6,000"
            ],
            [
              "B03",
              "Equipment supplier payable",
              "Bank",
              "4,000"
            ],
            [
              "B04",
              "Petty cash",
              "Bank",
              "2,000"
            ],
            [
              "V01",
              "Delivery expense",
              "Petty cash",
              "500"
            ]
          ]
        }
      ]
    },
    {
      "id": "the-bank-ledger",
      "title": "Close the Bank ledger",
      "text": "The Bank ledger gathers the two receipts on the debit side (KSh 36,000) and the payment and float transfer on the credit side (KSh 6,000). That leaves a debit balance of KSh 30,000. On paper, carry the balance down on the shorter credit side to make both columns total KSh 36,000. In the next period, bring it down on the debit side. That debit balance goes to the trial balance.\n\nDo the same subtraction on the other accounts. Trade receivables closes with KSh 3,000 Dr, the equipment supplier is owed KSh 8,000 Cr, and petty cash has KSh 1,500 Dr.\n\nBank T-account · KSh\nDebit details · Debit · Credit details · Credit\nMon B01 · Capital · 30,000 · Thu B03 · Equipment supplier · 4,000\nWed B02 · Trade receivables · 6,000 · Thu B04 · Petty cash · 2,000\n— · — · Fri · Balance carried down · 30,000\nTotal · 36,000 · Total · 36,000\nNext period · Balance brought down · 30,000 · — · —",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The Bank ledger gathers the two receipts on the debit side (KSh 36,000) and the payment and float transfer on the credit side (KSh 6,000). That leaves a debit balance of KSh 30,000. On paper, carry the balance down on the shorter credit side to make both columns total KSh 36,000. In the next period, bring it down on the debit side. That debit balance goes to the trial balance."
        },
        {
          "kind": "paragraph",
          "text": "Do the same subtraction on the other accounts. Trade receivables closes with KSh 3,000 Dr, the equipment supplier is owed KSh 8,000 Cr, and petty cash has KSh 1,500 Dr."
        },
        {
          "kind": "table",
          "caption": "Bank T-account · KSh",
          "columns": [
            "Debit details",
            "Debit",
            "Credit details",
            "Credit"
          ],
          "rows": [
            [
              "Mon B01 · Capital",
              "30,000",
              "Thu B03 · Equipment supplier",
              "4,000"
            ],
            [
              "Wed B02 · Trade receivables",
              "6,000",
              "Thu B04 · Petty cash",
              "2,000"
            ],
            [
              "—",
              "—",
              "Fri · Balance carried down",
              "30,000"
            ],
            [
              "Total",
              "36,000",
              "Total",
              "36,000"
            ],
            [
              "Next period · Balance brought down",
              "30,000",
              "—",
              "—"
            ]
          ]
        }
      ]
    }
  ],
  "trial-balance-and-statements": [
    {
      "id": "check-the-ledger",
      "title": "Friday’s trial balance",
      "text": "Copy each closing ledger balance once, keeping its debit or credit side. When the totals disagree, check amounts, account sides, missing entries and addition. An entry missed on both sides can still leave the columns equal. If Nuru forgets F01 entirely, both receivables and fees are understated even though the trial balance agrees.\n\nNuru Print Studio · Friday close · KSh\nAccount · Debit · Credit\nBank · 30,000 · —\nEquipment · 12,000 · —\nTrade receivables · 3,000 · —\nPetty cash · 1,500 · —\nDelivery expense · 500 · —\nEquipment supplier payable · — · 8,000\nCapital · — · 30,000\nService fees · — · 9,000\nTotal · 47,000 · 47,000",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Copy each closing ledger balance once, keeping its debit or credit side. When the totals disagree, check amounts, account sides, missing entries and addition. An entry missed on both sides can still leave the columns equal. If Nuru forgets F01 entirely, both receivables and fees are understated even though the trial balance agrees."
        },
        {
          "kind": "table",
          "caption": "Nuru Print Studio · Friday close · KSh",
          "columns": [
            "Account",
            "Debit",
            "Credit"
          ],
          "rows": [
            [
              "Bank",
              "30,000",
              "—"
            ],
            [
              "Equipment",
              "12,000",
              "—"
            ],
            [
              "Trade receivables",
              "3,000",
              "—"
            ],
            [
              "Petty cash",
              "1,500",
              "—"
            ],
            [
              "Delivery expense",
              "500",
              "—"
            ],
            [
              "Equipment supplier payable",
              "—",
              "8,000"
            ],
            [
              "Capital",
              "—",
              "30,000"
            ],
            [
              "Service fees",
              "—",
              "9,000"
            ],
            [
              "Total",
              "47,000",
              "47,000"
            ]
          ]
        }
      ]
    },
    {
      "id": "report-the-week",
      "title": "What the records say about the business",
      "text": "The statement of profit or loss answers how the studio did during the week. Prepare it from the KSh 9,000 of fees earned and KSh 500 of delivery expense. Profit is KSh 8,500. The customer’s part payment changes what she owes, while the completed job determines the amount earned.\n\nThe statement of financial position describes the business at Friday close. Nuru has equipment of KSh 12,000 and current assets of KSh 34,500, giving total assets of KSh 46,500. The equipment supplier is owed KSh 8,000. Capital of KSh 30,000 plus the week’s profit of KSh 8,500 gives equity of KSh 38,500. Together, liabilities and equity equal KSh 46,500.",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "The statement of profit or loss answers how the studio did during the week. Prepare it from the KSh 9,000 of fees earned and KSh 500 of delivery expense. Profit is KSh 8,500. The customer’s part payment changes what she owes, while the completed job determines the amount earned."
        },
        {
          "kind": "paragraph",
          "text": "The statement of financial position describes the business at Friday close. Nuru has equipment of KSh 12,000 and current assets of KSh 34,500, giving total assets of KSh 46,500. The equipment supplier is owed KSh 8,000. Capital of KSh 30,000 plus the week’s profit of KSh 8,500 gives equity of KSh 38,500. Together, liabilities and equity equal KSh 46,500."
        }
      ]
    },
    {
      "id": "pori-practice",
      "title": "On your own · Pori Design Studio",
      "text": "Set aside 25 minutes. Pori is a sole trader with no opening balances. All jobs are complete. Leave tax, depreciation and other adjustments out of the exercise.\n\nOn Monday, the owner deposits KSh 40,000 into the studio’s bank account (B11). Equipment costing KSh 16,000 arrives on credit (P22). On Tuesday, Pori bills KSh 11,000 for a finished design job (F12). The customer transfers KSh 7,000 on Wednesday (R12/B12).\n\nOn Thursday, Pori pays KSh 5,000 towards P22 (B13) and withdraws KSh 3,000 for the petty-cash float (B14). On Friday, the studio pays KSh 800 from its float for delivery (V11).\n\n1. Name the book of original entry for each transaction. Give both records for B14. [7 marks]\n\n2. Give the debit and credit entries. Balance Bank, Trade receivables, Equipment supplier payable and Petty cash. [11 marks]\n\n3. Prepare the Friday trial balance. Calculate the week’s profit and show assets, liabilities and equity at Friday close. [7 marks]\n\n4. What happens to the trial balance if you post the debit for V11 but miss the credit? Give the difference and the larger column. [2 marks]",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "Set aside 25 minutes. Pori is a sole trader with no opening balances. All jobs are complete. Leave tax, depreciation and other adjustments out of the exercise."
        },
        {
          "kind": "paragraph",
          "text": "On Monday, the owner deposits KSh 40,000 into the studio’s bank account (B11). Equipment costing KSh 16,000 arrives on credit (P22). On Tuesday, Pori bills KSh 11,000 for a finished design job (F12). The customer transfers KSh 7,000 on Wednesday (R12/B12)."
        },
        {
          "kind": "paragraph",
          "text": "On Thursday, Pori pays KSh 5,000 towards P22 (B13) and withdraws KSh 3,000 for the petty-cash float (B14). On Friday, the studio pays KSh 800 from its float for delivery (V11)."
        },
        {
          "kind": "list",
          "ordered": true,
          "items": [
            "Name the book of original entry for each transaction. Give both records for B14. [7 marks]",
            "Give the debit and credit entries. Balance Bank, Trade receivables, Equipment supplier payable and Petty cash. [11 marks]",
            "Prepare the Friday trial balance. Calculate the week’s profit and show assets, liabilities and equity at Friday close. [7 marks]",
            "What happens to the trial balance if you post the debit for V11 but miss the credit? Give the difference and the larger column. [2 marks]"
          ]
        }
      ]
    },
    {
      "id": "feedback",
      "title": "Open the 27-mark guide after you finish",
      "text": "Open the updated chapter reader for the marking guide.",
      "blocks": [
        {
          "kind": "paragraph",
          "text": "First records (7). Award one per transaction. B11 is a cashbook receipt. P22 is a general journal entry, supported by the equipment register. F12 is entered in the fee-invoice register or a credit-fee journal. R12/B12 is a cashbook receipt. B13 is a cashbook payment. B14 needs a cashbook payment and petty-cash receipt together. V11 goes in petty cash payments."
        },
        {
          "kind": "paragraph",
          "text": "Double entry (7). Award one per correct pair and amount. B11: Dr Bank, Cr Capital, KSh 40,000. P22: Dr Equipment, Cr Equipment supplier payable, KSh 16,000. F12: Dr Trade receivables, Cr Service fees, KSh 11,000. R12/B12: Dr Bank, Cr Trade receivables, KSh 7,000. B13: Dr Equipment supplier payable, Cr Bank, KSh 5,000. B14: Dr Petty cash, Cr Bank, KSh 3,000. V11: Dr Delivery expense, Cr Petty cash, KSh 800."
        },
        {
          "kind": "paragraph",
          "text": "Balancing (4). One per correct amount and side: Bank KSh 39,000 Dr, Trade receivables KSh 4,000 Dr, Equipment supplier payable KSh 11,000 Cr, and Petty cash KSh 2,200 Dr."
        },
        {
          "kind": "paragraph",
          "text": "Trial balance and statements (7). One mark for each correct set of balances on the debit and credit sides, and one for both totals. Add Equipment KSh 16,000 and Delivery expense KSh 800 on the debit side. Add Capital KSh 40,000 and Service fees KSh 11,000 on the credit side. The totals are KSh 62,000 each. Award one mark each for profit KSh 10,200, assets KSh 61,200, liabilities KSh 11,000 and closing equity KSh 50,200. Accept correct calculations carried forward where the classification is right."
        },
        {
          "kind": "paragraph",
          "text": "Missing credit (2). Debit exceeds credit (one mark) by KSh 800 (one mark). Petty cash is overstated by the same amount. Post the missing credit and check again."
        }
      ]
    }
  ]
}
$chapters$::jsonb;
  v_module uuid;
  v_matched integer;
begin
  select m.id into strict v_module
  from public.modules m join public.courses c on c.id=m.course_id
  where c.slug='kasneb-cpa' and c.status='live' and c.qualifying_body='KASNEB'
    and m.slug='ca11' and m.qualification_level='Foundation'
  for update of m;

  -- Lock only the published chapters this migration owns.
  perform 1 from public.topics t
  where t.module_id=v_module
    and t.content_status='published'
    and (t.slug,t.sequence_number) in (
      ('source-documents-and-books',4),('double-entry-and-ledgers',5),('trial-balance-and-statements',6)
    )
  order by t.sequence_number for update;

  select count(*) into v_matched
  from public.topics t
  join (values
    ('source-documents-and-books',4,'d3a9fad4de214b6b072c0066c82a85ed'),
    ('double-entry-and-ledgers',5,'86a515d92e8317d09fe28204a085bc8a'),
    ('trial-balance-and-statements',6,'854124a75772779b6e49b545ee2bbb5a')
  ) expected(slug,position,source_hash)
    on t.slug=expected.slug and t.sequence_number=expected.position
  where t.module_id=v_module and t.content_status='published'
    and (md5(t.concept_tab::text)=expected.source_hash or t.concept_tab=v_chapters->t.slug);
  if v_matched <> 3 then
    raise exception 'CA11 book format requires all three exact-source published Unit 02 chapters';
  end if;

  update public.topics t
  set concept_tab=v_chapters->t.slug
  where t.module_id=v_module and t.content_status='published'
    and (t.slug,t.sequence_number) in (
      ('source-documents-and-books',4),('double-entry-and-ledgers',5),('trial-balance-and-statements',6)
    )
    and t.concept_tab is distinct from v_chapters->t.slug;
end
$ca11_book$;
