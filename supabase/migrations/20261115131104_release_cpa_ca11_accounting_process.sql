-- VibeSchool CPA Foundation CA11 Unit 2, KASNEB June 2024 syllabus §2.1–2.5.
-- Additive publication through the existing Learn topic and protected quiz tables.
-- The published Unit 1 and all course, account and privilege state are preserved.
begin;
create temporary table vibeschool_ca11_unit02_packet(data jsonb not null) on commit drop;
insert into pg_temp.vibeschool_ca11_unit02_packet(data)
values ($unit02$
{
  "metadata": {
    "source": "https://www.kasneb.or.ke/wp-content/uploads/2024/09/CPA-Syllabus-Reviewed-June-2024.pdf",
    "locator": "CA11, printed p. 1, 2.1–2.5",
    "unit": 2
  },
  "topics": [
    {
      "slug": "source-documents-and-books",
      "title": "From document to first entry",
      "subtitle": "Source documents and books of original entry",
      "sequence_number": 4,
      "concept_tab": [
        {
          "title": "From document to first entry",
          "text": "A customer at Nuru Print Studio says she paid yesterday. The studio's file contains her invoice for KSh 9,000. Has she paid? The invoice tells you what was billed. To establish payment, look for a receipt and match it to the bank or M-PESA record. If you record the invoice and the payment as two sales, the books will show revenue the studio never earned."
        },
        {
          "title": "Read the document before recording it",
          "text": "Check the date, document reference, parties, amount, goods or services, and whether payment is due or already made. A supplier invoice supports an amount owed. A receipt acknowledges money received. A bank record shows money moving through the account. A petty-cash voucher records who received money from the cash tin, why and how much. Keep references with the entries so another person can follow the trail."
        },
        {
          "title": "Transaction",
          "text": "First record in this system"
        },
        {
          "title": "Credit sale of goods normally sold by the business",
          "text": "Sales journal"
        },
        {
          "title": "Credit purchase of goods for resale",
          "text": "Purchases journal"
        },
        {
          "title": "Money received or paid through bank or cash",
          "text": "Cashbook"
        },
        {
          "title": "Small payments from a separate cash float",
          "text": "Petty cash book"
        },
        {
          "title": "Equipment bought on credit",
          "text": "General journal"
        },
        {
          "title": "Read the document before recording it",
          "text": "A service business can use a dedicated fee-invoice register. In this case the register also serves as its book of original entry for fees billed on credit. Other registers, such as an equipment register, track details like serial number, cost and location. An equipment register supports the ledger entry and does not post a second purchase. In a digital system, one approved transaction may update several records from the same entry."
        },
        {
          "title": "Read the document before recording it",
          "text": "For example, this is how three of Nuru’s records look when filled in."
        },
        {
          "title": "Record",
          "text": "Day · Ref · Details · KSh"
        },
        {
          "title": "Fee-invoice register",
          "text": "Tue · F01 · Credit print job · 9,000 billed"
        },
        {
          "title": "Cashbook, bank receipts",
          "text": "Wed · R01/B02 · Part payment of F01 · 6,000 received"
        },
        {
          "title": "Petty cash book, payments",
          "text": "Fri · V01 · Delivery · 500 paid"
        },
        {
          "title": "Read the document before recording it",
          "text": "If a stationery shop receives KSh 4,000 of exercise books on credit for resale, its purchases journal records the supplier, invoice reference and KSh 4,000. A printer bought for the shop's own use goes in the general journal and equipment register instead."
        },
        {
          "title": "Worked case · Nuru Print Studio",
          "text": "The studio is a sole trader. All figures are in KSh. All jobs mentioned are complete. There are no opening balances, taxes, depreciation or other adjustments in this exercise. A paid supplier amount below relates to the equipment invoice."
        },
        {
          "title": "Day and evidence",
          "text": "Event · First entry"
        },
        {
          "title": "Mon · Bank ref B01",
          "text": "Owner deposits 30,000 into the business bank account · Cashbook receipt 30,000"
        },
        {
          "title": "Mon · Supplier invoice P17",
          "text": "Studio takes delivery of a printer costing 12,000 on credit · General journal 12,000; add printer to equipment register"
        },
        {
          "title": "Tue · Invoice F01",
          "text": "Studio bills a customer 9,000 for a completed print job · Fee-invoice register 9,000"
        },
        {
          "title": "Wed · Receipt R01 / bank ref B02",
          "text": "Customer pays 6,000 towards F01 by bank transfer · Cashbook receipt 6,000"
        },
        {
          "title": "Thu · Bank ref B03",
          "text": "Studio pays 4,000 towards P17 by bank transfer · Cashbook payment 4,000"
        },
        {
          "title": "Thu · Withdrawal slip B04",
          "text": "Studio moves 2,000 from bank to petty cash · Cashbook payment and petty-cash receipt linked by B04"
        },
        {
          "title": "Fri · Voucher V01",
          "text": "Studio pays 500 from petty cash for delivery · Petty cash book payment 500"
        },
        {
          "title": "Worked case · Nuru Print Studio",
          "text": "The cash float transfer has two records because two locations are involved. Post it once as a single double entry."
        }
      ],
      "kenya_context_tab": [
        {
          "title": "The studio’s records",
          "text": "A bank or M-PESA confirmation can be matched to the invoice or receipt using the transaction reference. The case amounts are in Kenyan shillings."
        }
      ],
      "common_errors_tab": [
        {
          "title": "Check this first",
          "text": "Match the transfer and receipt to the existing invoice. Record a collection against the customer balance without booking the fee again."
        }
      ],
      "clinical_tip_tab": [
        {
          "title": "Working habit",
          "text": "Write the invoice or receipt reference beside the record so another person can trace it."
        }
      ]
    },
    {
      "slug": "double-entry-and-ledgers",
      "title": "From first entry to ledger",
      "subtitle": "Debits, credits and closing balances",
      "sequence_number": 5,
      "concept_tab": [
        {
          "title": "From first entry to ledger",
          "text": "For each transaction, name the two accounts that change. Then identify whether each increases or decreases. Assets and expenses increase on the debit side. Liabilities, owner’s capital and revenue increase on the credit side. Decreases go on the opposite side."
        },
        {
          "title": "From first entry to ledger",
          "text": "For F01, the completed job earns revenue, so credit Service fees. The customer owes money, so debit Trade receivables. When the customer pays later, Bank increases (debit) and Trade receivables decreases (credit). The fee has already been recorded."
        },
        {
          "title": "Post the Nuru transactions",
          "text": "The table shows the debit and credit effect of each event. In a manual system where the cashbook already serves as the bank or cash ledger, post the corresponding side to the other account without recreating the cashbook side as a second entry."
        },
        {
          "title": "Ref",
          "text": "Debit · Credit · KSh"
        },
        {
          "title": "B01",
          "text": "Bank · Capital · 30,000"
        },
        {
          "title": "P17",
          "text": "Equipment · Equipment supplier payable · 12,000"
        },
        {
          "title": "F01",
          "text": "Trade receivables · Service fees · 9,000"
        },
        {
          "title": "R01/B02",
          "text": "Bank · Trade receivables · 6,000"
        },
        {
          "title": "B03",
          "text": "Equipment supplier payable · Bank · 4,000"
        },
        {
          "title": "B04",
          "text": "Petty cash · Bank · 2,000"
        },
        {
          "title": "V01",
          "text": "Delivery expense · Petty cash · 500"
        },
        {
          "title": "Post the Nuru transactions",
          "text": "A ledger account groups entries by account and retains their dates and references. The Bank account has KSh 36,000 on the debit side and KSh 6,000 on the credit side. The difference is a KSh 30,000 debit balance. When closing a paper T-account, write “balance carried down” on the shorter credit side to total both sides at KSh 36,000. Bring the balance down on the debit side in the next period. The debit balance is what goes into the trial balance."
        },
        {
          "title": "Bank T-account · debit",
          "text": "KSh · Bank T-account · credit · KSh"
        },
        {
          "title": "Bank T-account · Mon B01 · Capital",
          "text": "Debit · Mon B01 · Capital · KSh 30,000 / Credit · Thu B03 · Equipment supplier payable · KSh 4,000"
        },
        {
          "title": "Bank T-account · Wed B02 · Trade receivables",
          "text": "Debit · Wed B02 · Trade receivables · KSh 6,000 / Credit · Thu B04 · Petty cash · KSh 2,000"
        },
        {
          "title": "Bank T-account · Fri · Balance carried down",
          "text": "Credit · Fri · Balance carried down · KSh 30,000"
        },
        {
          "title": "Total",
          "text": "36,000 · Total · 36,000"
        },
        {
          "title": "Bank T-account · Next period · Balance brought down",
          "text": "Debit · Next period · Balance brought down · KSh 30,000"
        },
        {
          "title": "Account to balance",
          "text": "Debit entries · Credit entries · Closing balance"
        },
        {
          "title": "Bank",
          "text": "36,000 · 6,000 · 30,000 Dr"
        },
        {
          "title": "Trade receivables",
          "text": "9,000 · 6,000 · 3,000 Dr"
        },
        {
          "title": "Equipment supplier payable",
          "text": "4,000 · 12,000 · 8,000 Cr"
        },
        {
          "title": "Petty cash",
          "text": "2,000 · 500 · 1,500 Dr"
        }
      ],
      "kenya_context_tab": [
        {
          "title": "The studio’s records",
          "text": "A bank or M-PESA confirmation can be matched to the invoice or receipt using the transaction reference. The case amounts are in Kenyan shillings."
        }
      ],
      "common_errors_tab": [
        {
          "title": "Check this first",
          "text": "Post each side once. A cashbook that serves as the bank ledger already carries the bank side."
        }
      ],
      "clinical_tip_tab": [
        {
          "title": "Working habit",
          "text": "Before assigning debit or credit, name each account, its class and whether it increased or decreased."
        }
      ]
    },
    {
      "slug": "trial-balance-and-statements",
      "title": "From ledger to statements",
      "subtitle": "Trial balance, financial statements and independent case",
      "sequence_number": 6,
      "concept_tab": [
        {
          "title": "From ledger to statements",
          "text": "A trial balance lists the closing balance of each ledger account in the debit or credit column. Copy each balance once. If the columns disagree, check amounts, sides, omitted postings and arithmetic. A balanced trial balance can still contain errors. For example, omitting both sides of F01 leaves the columns equal while understating revenue and receivables."
        },
        {
          "title": "Ledger account",
          "text": "Debit KSh · Credit KSh"
        },
        {
          "title": "Bank",
          "text": "Debit KSh 30,000"
        },
        {
          "title": "Equipment",
          "text": "Debit KSh 12,000"
        },
        {
          "title": "Trade receivables",
          "text": "Debit KSh 3,000"
        },
        {
          "title": "Petty cash",
          "text": "Debit KSh 1,500"
        },
        {
          "title": "Delivery expense",
          "text": "Debit KSh 500"
        },
        {
          "title": "Equipment supplier payable",
          "text": "Credit KSh 8,000"
        },
        {
          "title": "Capital",
          "text": "Credit KSh 30,000"
        },
        {
          "title": "Service fees",
          "text": "Credit KSh 9,000"
        },
        {
          "title": "Total",
          "text": "47,000 · 47,000"
        },
        {
          "title": "Nuru Print Studio · Trial balance at Friday close",
          "text": "Statement of profit or loss for the week. Service fees KSh 9,000 less delivery expense KSh 500 gives profit of KSh 8,500. The KSh 6,000 bank collection settles part of the customer balance. The full KSh 9,000 is revenue earned this week."
        },
        {
          "title": "Nuru Print Studio · Trial balance at Friday close",
          "text": "Statement of financial position at Friday close. Equipment KSh 12,000 plus current assets of KSh 34,500 (bank, receivables and petty cash) gives total assets of KSh 46,500. The equipment supplier is owed KSh 8,000. Closing owner’s equity is KSh 38,500 (capital KSh 30,000 plus profit KSh 8,500). Liabilities plus equity equal KSh 46,500."
        },
        {
          "title": "Independent case · Pori Design Studio",
          "text": "Take 25 minutes. Write your entries, balances and statements before opening Practice. The questions check your results."
        },
        {
          "title": "Pori · task",
          "text": "Allow 25 minutes. Show document references beside your entries. Pori is a sole trader. All jobs are complete. There are no opening balances, taxes, depreciation or other adjustments. The bank payments relate to the documents identified below."
        },
        {
          "title": "Day and evidence",
          "text": "Event"
        },
        {
          "title": "Mon · B11",
          "text": "Owner deposits KSh 40,000 into the business bank account."
        },
        {
          "title": "Mon · P22",
          "text": "Equipment delivered on credit for KSh 16,000."
        },
        {
          "title": "Tue · F12",
          "text": "Customer billed KSh 11,000 for a completed design job."
        },
        {
          "title": "Wed · R12/B12",
          "text": "Customer transfers KSh 7,000 towards F12."
        },
        {
          "title": "Thu · B13",
          "text": "Studio pays KSh 5,000 towards P22 by bank transfer."
        },
        {
          "title": "Thu · B14",
          "text": "Studio withdraws KSh 3,000 from bank for the petty-cash float."
        },
        {
          "title": "Fri · V11",
          "text": "Petty cash pays KSh 800 for delivery."
        },
        {
          "title": "Pori · task",
          "text": "1. State the first record for each transaction. Identify both records for B14. [7]"
        },
        {
          "title": "Pori · task",
          "text": "2. Show the debit and credit for all seven transactions, then balance Bank, Trade receivables, Equipment supplier payable and Petty cash. [11]"
        },
        {
          "title": "Pori · task",
          "text": "3. Prepare the trial balance at Friday close. Give profit for the week and show assets, liabilities and equity at Friday close. [7]"
        },
        {
          "title": "Pori · task",
          "text": "4. Suppose the debit side of V11 is posted but its credit side is missed. Which column is greater and by how much? [2]"
        }
      ],
      "kenya_context_tab": [
        {
          "title": "The studio’s records",
          "text": "A bank or M-PESA confirmation can be matched to the invoice or receipt using the transaction reference. The case amounts are in Kenyan shillings."
        }
      ],
      "common_errors_tab": [
        {
          "title": "Check this first",
          "text": "A balanced trial balance can hide a complete omission. Reconcile documents and ledger entries as well as the two totals."
        }
      ],
      "clinical_tip_tab": [
        {
          "title": "Working habit",
          "text": "Check the period on profit or loss and the reporting date on the statement of financial position."
        }
      ]
    }
  ],
  "questions": [
    {
      "topic_slug": "source-documents-and-books",
      "question_text": "What does Nuru invoice F01 establish?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Bank received KSh 9,000"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Petty cash paid KSh 9,000"
        },
        {
          "id": "c",
          "label": "C",
          "text": "The completed job was billed at KSh 9,000"
        },
        {
          "id": "d",
          "label": "D",
          "text": "The customer owes nothing"
        }
      ],
      "correct_option_id": "c",
      "explanation": "F01 supports fees billed of KSh 9,000. R01 and the bank record separately support the payment of KSh 6,000."
    },
    {
      "topic_slug": "source-documents-and-books",
      "question_text": "A stationer buys exercise books for resale on supplier credit. Where is the invoice first entered?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Purchases journal"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Cashbook receipts"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Petty cash book"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Equipment register"
        }
      ],
      "correct_option_id": "a",
      "explanation": "The purchases journal records credit purchases of goods for resale. There is no cash payment at the time of purchase."
    },
    {
      "topic_slug": "source-documents-and-books",
      "question_text": "Where does Pori record a credit purchase of equipment?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Sales journal"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Purchases journal for resale goods"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Cashbook payment"
        },
        {
          "id": "d",
          "label": "D",
          "text": "General journal, supported by the equipment register"
        }
      ],
      "correct_option_id": "d",
      "explanation": "P22 relates to equipment for use by the business. Record the transaction in the general journal and the equipment details in its register."
    },
    {
      "topic_slug": "source-documents-and-books",
      "question_text": "Which initial records should carry Nuru reference B04?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Only the fee-invoice register"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Bank cashbook payment and petty-cash receipt"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Sales and purchases journals"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Two petty-cash payments"
        }
      ],
      "correct_option_id": "b",
      "explanation": "The bank balance falls while the float rises. Link the cashbook payment and petty-cash receipt using B04."
    },
    {
      "topic_slug": "double-entry-and-ledgers",
      "question_text": "How should Nuru post the bank receipt for part payment of F01?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Debit Bank, credit Service fees"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Debit Bank, credit Trade receivables"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Debit Trade receivables, credit Bank"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Debit Delivery expense, credit Bank"
        }
      ],
      "correct_option_id": "b",
      "explanation": "Debit Bank KSh 6,000 and credit Trade receivables KSh 6,000. The original invoice already recognised revenue."
    },
    {
      "topic_slug": "double-entry-and-ledgers",
      "question_text": "Pori pays KSh 5,000 by bank transfer towards the amount owed for equipment on invoice P22. How should Pori post the payment?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Debit Equipment, credit Bank"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Debit Bank, credit Equipment"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Debit Equipment supplier payable, credit Bank"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Debit Bank, credit Equipment supplier payable"
        }
      ],
      "correct_option_id": "c",
      "explanation": "Debit Equipment supplier payable KSh 5,000 to reduce the liability. Credit Bank KSh 5,000 to reduce the bank asset."
    },
    {
      "topic_slug": "double-entry-and-ledgers",
      "question_text": "What is Nuru’s closing Bank balance?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "KSh 30,000 debit"
        },
        {
          "id": "b",
          "label": "B",
          "text": "KSh 30,000 credit"
        },
        {
          "id": "c",
          "label": "C",
          "text": "KSh 36,000 debit"
        },
        {
          "id": "d",
          "label": "D",
          "text": "KSh 6,000 credit"
        }
      ],
      "correct_option_id": "a",
      "explanation": "Bank receipts are KSh 36,000 and bank payments total KSh 6,000. The remaining asset balance is KSh 30,000 debit."
    },
    {
      "topic_slug": "double-entry-and-ledgers",
      "question_text": "How should Nuru post voucher V01 for delivery?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Debit Petty cash, credit Bank"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Debit Petty cash, credit Delivery expense"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Debit Bank, credit Delivery expense"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Debit Delivery expense, credit Petty cash"
        }
      ],
      "correct_option_id": "d",
      "explanation": "Debit Delivery expense KSh 500 and credit Petty cash KSh 500. The transaction increases expense and reduces the float."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "After completing the Pori case, what totals should appear in its trial balance?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "KSh 61,200 per column"
        },
        {
          "id": "b",
          "label": "B",
          "text": "KSh 62,000 per column"
        },
        {
          "id": "c",
          "label": "C",
          "text": "KSh 47,000 per column"
        },
        {
          "id": "d",
          "label": "D",
          "text": "KSh 50,200 per column"
        }
      ],
      "correct_option_id": "b",
      "explanation": "Debit: Bank 39,000 + Equipment 16,000 + Receivables 4,000 + Petty cash 2,200 + Delivery 800 = 62,000. Credit: Capital 40,000 + Equipment supplier payable 11,000 + Service fees 11,000 = 62,000."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "What are Pori’s profit and closing equity, in that order?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "KSh 7,000 and KSh 47,000"
        },
        {
          "id": "b",
          "label": "B",
          "text": "KSh 11,000 and KSh 51,000"
        },
        {
          "id": "c",
          "label": "C",
          "text": "KSh 10,200 and KSh 50,200"
        },
        {
          "id": "d",
          "label": "D",
          "text": "KSh 10,200 and KSh 61,200"
        }
      ],
      "correct_option_id": "c",
      "explanation": "Fees of 11,000 less delivery expense of 800 give profit of 10,200. Add profit to capital of 40,000 for closing equity of 50,200."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "What are Pori’s total assets and total liabilities at close?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "KSh 61,200 and KSh 11,000"
        },
        {
          "id": "b",
          "label": "B",
          "text": "KSh 62,000 and KSh 11,000"
        },
        {
          "id": "c",
          "label": "C",
          "text": "KSh 61,200 and KSh 16,000"
        },
        {
          "id": "d",
          "label": "D",
          "text": "KSh 50,200 and KSh 11,000"
        }
      ],
      "correct_option_id": "a",
      "explanation": "Assets total 39,000 + 16,000 + 4,000 + 2,200 = 61,200. The equipment supplier is owed 16,000 less 5,000 = 11,000."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "What happens if Pori posts only the debit side of its KSh 800 delivery voucher V11?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Credit exceeds debit by KSh 800"
        },
        {
          "id": "b",
          "label": "B",
          "text": "Debit exceeds credit by KSh 1,600"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Columns stay equal"
        },
        {
          "id": "d",
          "label": "D",
          "text": "Debit exceeds credit by KSh 800"
        }
      ],
      "correct_option_id": "d",
      "explanation": "The delivery debit remains and the petty-cash credit is missing, so debit exceeds credit by KSh 800 and petty cash is overstated by that amount."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "Which set shows the correct four Pori entries for capital, billing, collection and the float transfer?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "B11 Dr Bank Cr Capital 40,000; F12 Dr Receivables Cr Fees 11,000; R12 Dr Bank Cr Receivables 7,000; B14 Dr Petty cash Cr Bank 3,000"
        },
        {
          "id": "b",
          "label": "B",
          "text": "B11 Dr Bank Cr Fees 40,000; F12 Dr Receivables Cr Fees 11,000; R12 Dr Bank Cr Receivables 7,000; B14 Dr Petty cash Cr Bank 3,000"
        },
        {
          "id": "c",
          "label": "C",
          "text": "B11 Dr Bank Cr Capital 40,000; F12 Dr Receivables Cr Fees 11,000; R12 Dr Bank Cr Fees 7,000; B14 Dr Petty cash Cr Bank 3,000"
        },
        {
          "id": "d",
          "label": "D",
          "text": "B11 Dr Bank Cr Capital 40,000; F12 Dr Bank Cr Fees 11,000; R12 Dr Bank Cr Receivables 7,000; B14 Dr Bank Cr Petty cash 3,000"
        }
      ],
      "correct_option_id": "a",
      "explanation": "Capital belongs in equity, F12 initially raises receivables, R12 clears part of that receivable, and B14 is a transfer. The other postings are P22 Dr Equipment Cr Equipment supplier payable 16,000, B13 Dr Equipment supplier payable Cr Bank 5,000, and V11 Dr Delivery expense Cr Petty cash 800."
    },
    {
      "topic_slug": "trial-balance-and-statements",
      "question_text": "Which pair of records handles Pori’s transfer B14?",
      "options": [
        {
          "id": "a",
          "label": "A",
          "text": "Two petty cash book payments"
        },
        {
          "id": "b",
          "label": "B",
          "text": "A sales journal and cashbook receipt"
        },
        {
          "id": "c",
          "label": "C",
          "text": "Bank cashbook payment and petty cash book receipt"
        },
        {
          "id": "d",
          "label": "D",
          "text": "A general journal and fee-invoice register"
        }
      ],
      "correct_option_id": "c",
      "explanation": "1. First records [7]. Award one per row. B11 cashbook receipt. P22 general journal (equipment register is a supporting record). F12 fee-invoice register or a consistent dedicated credit-fee journal. R12/B12 cashbook receipt. B13 cashbook payment. B14 cashbook payment and petty-cash receipt (both for the mark). V11 petty cash book payment. For the full case, award 7 for first records, 11 for double entry and balancing (one per complete pair, one per balance with side), 7 for trial balance and statements (one each for debits, credits, totals, profit, assets, liabilities and equity), and 2 for the missing-credit check (one each for direction and amount)."
    }
  ]
}
$unit02$::jsonb);

do $publish_ca11_unit02$
declare
  v_module uuid;
  v_packet jsonb;
  v_count integer;
begin
  select m.id into strict v_module
  from public.modules m join public.courses c on c.id=m.course_id
  where c.slug='kasneb-cpa' and c.status='live' and c.qualification_code='CPA'
    and c.qualifying_body='KASNEB' and c.syllabus_source_url like 'https://www.kasneb.or.ke/%'
    and m.slug='ca11' and m.qualification_level='Foundation'
    and m.qualification_requirement='required'
  for update of m;

  if (select count(*) from public.topics t where t.module_id=v_module
      and t.content_status='published'
      and (t.slug,t.sequence_number) in (
        ('why-accounts-matter',1), ('five-elements-of-financial-statements',2), ('the-equation-in-action',3)
      )) <> 3 then
    raise exception 'CA11 Unit 02 requires the existing published introductory unit';
  end if;

  select data into strict v_packet from pg_temp.vibeschool_ca11_unit02_packet;
  if jsonb_array_length(v_packet->'topics') <> 3
      or jsonb_array_length(v_packet->'questions') <> 14
      or v_packet->'metadata'->>'unit' is distinct from '2' then
    raise exception 'CA11 Unit 02 authoring packet does not match the release scope';
  end if;

  if exists (
    select 1 from public.topics t
    cross join jsonb_to_recordset(v_packet->'topics') as authored(slug text, sequence_number integer)
    where t.module_id=v_module and
      (t.slug=authored.slug or t.sequence_number=authored.sequence_number)
  ) then
    raise exception 'CA11 Unit 02 topic slug or placement already exists';
  end if;

  if to_regprocedure('public.get_public_quiz_questions(uuid)') is null
      or to_regprocedure('public.submit_quiz_answer(uuid,text)') is null then
    raise exception 'CA11 Unit 02 requires the protected practice service';
  end if;

  insert into public.topics
    (module_id,slug,title,subtitle,sequence_number,concept_tab,kenya_context_tab,
     common_errors_tab,clinical_tip_tab,content_status)
  select v_module,slug,title,subtitle,sequence_number,concept_tab,kenya_context_tab,
      common_errors_tab,clinical_tip_tab,'in_review'
  from jsonb_to_recordset(v_packet->'topics') authored(
    slug text,title text,subtitle text,sequence_number integer,concept_tab jsonb,
    kenya_context_tab jsonb,common_errors_tab jsonb,clinical_tip_tab jsonb);

  insert into public.quiz_questions(topic_id,question_text,options,correct_option_id,explanation)
  select t.id,q.question_text,q.options,q.correct_option_id,q.explanation
  from jsonb_to_recordset(v_packet->'questions') q(
    topic_slug text,question_text text,options jsonb,correct_option_id text,explanation text)
  join public.topics t on t.module_id=v_module and t.slug=q.topic_slug
  join jsonb_to_recordset(v_packet->'topics') authored(slug text) on authored.slug=t.slug
  where jsonb_array_length(q.options)=4 and length(btrim(q.explanation))>=65
    and (select count(distinct o->>'id') from jsonb_array_elements(q.options) o)=4
    and exists (select 1 from jsonb_array_elements(q.options) o where o->>'id'=q.correct_option_id);
  get diagnostics v_count=row_count;
  if v_count <> 14 then
    raise exception 'CA11 Unit 02 question integrity check failed: %', v_count;
  end if;

  update public.topics t set content_status='published'
  from jsonb_to_recordset(v_packet->'topics') authored(slug text)
  where t.module_id=v_module and t.slug=authored.slug and t.content_status='in_review'
    and jsonb_array_length(t.concept_tab)>=6;
  get diagnostics v_count=row_count;
  if v_count <> 3 then
    raise exception 'CA11 Unit 02 lesson integrity check failed: %', v_count;
  end if;
end $publish_ca11_unit02$;

commit;
