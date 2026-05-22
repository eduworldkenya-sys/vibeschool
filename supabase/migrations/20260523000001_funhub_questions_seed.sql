-- FUNHUB QUESTIONS SEED — CBC aligned

insert into funhub_questions (subject, grade, strand, question_text, options, correct, explanation, difficulty) values

-- MATHS GRADE 1
('maths', 1, 'Numbers', 'What is 2 + 3?', '["3","4","5","6"]', '5', 'Counting forward: 2 + 3 = 5', 'easy'),
('maths', 1, 'Numbers', 'Which number comes after 9?', '["7","8","10","11"]', '10', '9 is followed by 10', 'easy'),
('maths', 1, 'Numbers', 'How many sides does a triangle have?', '["2","3","4","5"]', '3', 'A triangle has 3 sides', 'easy'),
('maths', 1, 'Numbers', 'What is 5 - 2?', '["2","3","4","1"]', '3', '5 take away 2 equals 3', 'easy'),
('maths', 1, 'Numbers', 'Which is the biggest number?', '["3","7","5","9"]', '9', '9 is the largest among 3, 7, 5, 9', 'easy'),

-- MATHS GRADE 2
('maths', 2, 'Numbers', 'What is 6 + 7?', '["11","12","13","14"]', '13', '6 + 7 = 13', 'easy'),
('maths', 2, 'Numbers', 'What is 15 - 8?', '["6","7","8","9"]', '7', '15 - 8 = 7', 'easy'),
('maths', 2, 'Measurement', 'How many minutes are in one hour?', '["30","45","60","100"]', '60', 'One hour = 60 minutes', 'easy'),
('maths', 2, 'Numbers', 'What is double 6?', '["10","11","12","13"]', '12', 'Double 6 means 6 × 2 = 12', 'easy'),
('maths', 2, 'Numbers', 'What is 10 + 10?', '["15","18","20","25"]', '20', '10 + 10 = 20', 'easy'),

-- MATHS GRADE 3
('maths', 3, 'Numbers', 'What is 4 × 3?', '["10","11","12","13"]', '12', '4 multiplied by 3 = 12', 'easy'),
('maths', 3, 'Numbers', 'What is 20 ÷ 4?', '["4","5","6","7"]', '5', '20 divided by 4 = 5', 'easy'),
('maths', 3, 'Numbers', 'What is half of 18?', '["7","8","9","10"]', '9', 'Half of 18 = 18 ÷ 2 = 9', 'easy'),
('maths', 3, 'Fractions', 'What fraction is shaded if 1 out of 4 parts is shaded?', '["1/2","1/3","1/4","2/4"]', '1/4', '1 part out of 4 = 1/4', 'easy'),
('maths', 3, 'Measurement', 'How many centimetres in a metre?', '["10","50","100","1000"]', '100', '1 metre = 100 centimetres', 'easy'),

-- MATHS GRADE 4
('maths', 4, 'Numbers', 'What is 12 × 12?', '["124","134","144","154"]', '144', '12 × 12 = 144', 'medium'),
('maths', 4, 'Numbers', 'What is 144 ÷ 12?', '["10","11","12","13"]', '12', '144 ÷ 12 = 12', 'medium'),
('maths', 4, 'Fractions', 'What is 1/2 + 1/4?', '["1/6","2/6","3/4","2/4"]', '3/4', '1/2 = 2/4, so 2/4 + 1/4 = 3/4', 'medium'),
('maths', 4, 'Geometry', 'How many degrees in a right angle?', '["45","60","90","180"]', '90', 'A right angle = 90 degrees', 'easy'),
('maths', 4, 'Numbers', 'What is the place value of 5 in 3,500?', '["Ones","Tens","Hundreds","Thousands"]', 'Hundreds', '5 is in the hundreds place in 3,500', 'medium'),

-- MATHS GRADE 5
('maths', 5, 'Numbers', 'What is 25% of 200?', '["25","40","50","75"]', '50', '25% = 25/100, so 25/100 × 200 = 50', 'medium'),
('maths', 5, 'Numbers', 'What is the LCM of 4 and 6?', '["8","10","12","24"]', '12', 'LCM of 4 and 6 is 12', 'medium'),
('maths', 5, 'Algebra', 'If x + 5 = 12, what is x?', '["5","6","7","8"]', '7', '12 - 5 = 7', 'medium'),
('maths', 5, 'Fractions', 'What is 3/4 of 40?', '["20","25","30","35"]', '30', '3/4 × 40 = 30', 'medium'),
('maths', 5, 'Geometry', 'What is the area of a rectangle 5cm by 8cm?', '["30cm²","35cm²","40cm²","45cm²"]', '40cm²', 'Area = length × width = 5 × 8 = 40cm²', 'medium'),

-- ENGLISH GRADE 1
('english', 1, 'Reading', 'Which letter makes the sound at the start of "apple"?', '["B","A","C","D"]', 'A', 'Apple starts with the letter A', 'easy'),
('english', 1, 'Vocabulary', 'What is the opposite of "big"?', '["Tall","Heavy","Small","Long"]', 'Small', 'The opposite of big is small', 'easy'),
('english', 1, 'Grammar', 'Which word is a name?', '["Run","Jump","Amina","Blue"]', 'Amina', 'Amina is a proper noun — a name', 'easy'),
('english', 1, 'Grammar', 'How many vowels are in the word "cake"?', '["1","2","3","4"]', '2', 'The vowels in cake are a and e', 'easy'),
('english', 1, 'Vocabulary', 'What sound does a cat make?', '["Bark","Moo","Meow","Roar"]', 'Meow', 'Cats meow', 'easy'),

-- ENGLISH GRADE 3
('english', 3, 'Grammar', 'Which sentence is correct?', '["She go to school","She goes to school","She going school","Her go school"]', 'She goes to school', 'Third person singular uses goes', 'easy'),
('english', 3, 'Vocabulary', 'What does "enormous" mean?', '["Tiny","Fast","Very large","Beautiful"]', 'Very large', 'Enormous means very large or huge', 'easy'),
('english', 3, 'Grammar', 'What is the plural of "child"?', '["Childs","Childes","Children","Childrens"]', 'Children', 'The irregular plural of child is children', 'easy'),
('english', 3, 'Grammar', 'Which is a describing word (adjective)?', '["Run","Happy","School","Quickly"]', 'Happy', 'Happy describes how someone feels — it is an adjective', 'easy'),
('english', 3, 'Reading', 'What punctuation ends a question?', '[".","!","?",","]', '?', 'Questions end with a question mark', 'easy'),

-- ENGLISH GRADE 5
('english', 5, 'Grammar', 'Identify the verb: "The dog barked loudly."', '["dog","barked","loudly","The"]', 'barked', 'Barked is the action word — the verb', 'medium'),
('english', 5, 'Comprehension', 'What does "predict" mean?', '["To look back","To guess what will happen","To describe","To explain"]', 'To guess what will happen', 'Predict means to say what you think will happen next', 'medium'),
('english', 5, 'Grammar', 'Which sentence is in past tense?', '["She runs fast","She will run","She ran fast","She is running"]', 'She ran fast', 'Ran is the past tense of run', 'medium'),
('english', 5, 'Vocabulary', 'What is a synonym for "happy"?', '["Sad","Angry","Joyful","Tired"]', 'Joyful', 'Joyful means the same as happy', 'easy'),
('english', 5, 'Writing', 'Which is the correct spelling?', '["Recieve","Receive","Receve","Receeve"]', 'Receive', 'The correct spelling is receive — i before e except after c', 'medium'),

-- SCIENCE GRADE 3
('science', 3, 'Living Things', 'What do plants need to make their own food?', '["Moonlight","Sunlight","Darkness","Rain only"]', 'Sunlight', 'Plants use sunlight, water and CO2 for photosynthesis', 'easy'),
('science', 3, 'Living Things', 'Which animal is a mammal?', '["Crocodile","Eagle","Cow","Frog"]', 'Cow', 'Cows are mammals — they are warm-blooded and nurse young', 'easy'),
('science', 3, 'Matter', 'Which state of matter has a fixed shape?', '["Gas","Liquid","Solid","Steam"]', 'Solid', 'Solids have a fixed shape and volume', 'easy'),
('science', 3, 'Human Body', 'What organ pumps blood around the body?', '["Brain","Lungs","Heart","Stomach"]', 'Heart', 'The heart pumps blood through the circulatory system', 'easy'),
('science', 3, 'Environment', 'What gas do plants release during photosynthesis?', '["Carbon dioxide","Nitrogen","Oxygen","Hydrogen"]', 'Oxygen', 'Plants release oxygen as a product of photosynthesis', 'easy'),

-- SCIENCE GRADE 5
('science', 5, 'Forces', 'What force pulls objects towards the Earth?', '["Magnetism","Friction","Gravity","Tension"]', 'Gravity', 'Gravity is the force of attraction between Earth and objects', 'easy'),
('science', 5, 'Matter', 'What happens to water when it is heated to 100°C?', '["It freezes","It evaporates","It melts","It condenses"]', 'It evaporates', 'Water boils and turns to steam (evaporates) at 100°C', 'medium'),
('science', 5, 'Living Things', 'What is the process by which plants make food?', '["Respiration","Digestion","Photosynthesis","Absorption"]', 'Photosynthesis', 'Photosynthesis is how plants make food using sunlight', 'easy'),
('science', 5, 'Human Body', 'Which organ is responsible for breathing?', '["Heart","Brain","Kidneys","Lungs"]', 'Lungs', 'The lungs take in oxygen and release carbon dioxide', 'easy'),
('science', 5, 'Environment', 'What is the main cause of soil erosion?', '["Wind and water","Sunlight","Planting trees","Building roads"]', 'Wind and water', 'Wind and water are the main agents of soil erosion', 'medium'),

-- KISWAHILI GRADE 2
('kiswahili', 2, 'Msamiati', 'Neno "chakula" linamaanisha nini kwa Kiingereza?', '["Water","Food","House","School"]', 'Food', 'Chakula kwa Kiingereza ni food', 'easy'),
('kiswahili', 2, 'Sarufi', 'Kipi ni salamu ya asubuhi?', '["Habari za jioni","Habari za asubuhi","Habari za usiku","Kwaheri"]', 'Habari za asubuhi', 'Asubuhi tunaomba habari za asubuhi', 'easy'),
('kiswahili', 2, 'Msamiati', 'Mnyama anayeitwa simba kwa Kiingereza ni?', '["Elephant","Giraffe","Lion","Zebra"]', 'Lion', 'Simba kwa Kiingereza ni Lion', 'easy'),
('kiswahili', 2, 'Msamiati', 'Neno "shule" kwa Kiingereza ni?', '["Home","Market","School","Church"]', 'School', 'Shule kwa Kiingereza ni school', 'easy'),
('kiswahili', 2, 'Sarufi', 'Jibu sahihi la "Habari?" ni?', '["Asante","Nzuri","Karibu","Tafadhali"]', 'Nzuri', 'Tunajibu Habari? kwa kusema Nzuri au Salama', 'easy'),

-- KISWAHILI GRADE 4
('kiswahili', 4, 'Sarufi', 'Wingi wa neno "mtoto" ni?', '["Watoto","Vitoto","Vitoto","Mtoto"]', 'Watoto', 'Mtoto → Watoto (ngeli ya M-WA)', 'easy'),
('kiswahili', 4, 'Sarufi', 'Kinyume cha neno "kubwa" ni?', '["Nzuri","Ndogo","Mrefu","Mfupi"]', 'Ndogo', 'Kinyume cha kubwa ni ndogo', 'easy'),
('kiswahili', 4, 'Msamiati', 'Neno "hospitali" linamaanisha?', '["Shule","Kanisa","Zahanati/Hospitali","Soko"]', 'Zahanati/Hospitali', 'Hospitali ni mahali watu wanatibiwa', 'easy'),
('kiswahili', 4, 'Sarufi', 'Sentensi sahihi ni ipi?', '["Mimi kwenda shule","Mimi ninaenda shule","Ninaenda mimi shule","Shule ninaenda mimi"]', 'Mimi ninaenda shule', 'Mpangilio sahihi wa sentensi ya Kiswahili', 'medium'),
('kiswahili', 4, 'Msamiati', 'Neno "mwalimu" kwa Kiingereza ni?', '["Student","Parent","Teacher","Principal"]', 'Teacher', 'Mwalimu kwa Kiingereza ni Teacher', 'easy'),

-- SOCIAL STUDIES GRADE 3
('social_studies', 3, 'Our Environment', 'What is the capital city of Kenya?', '["Mombasa","Kisumu","Nairobi","Nakuru"]', 'Nairobi', 'Nairobi is the capital and largest city of Kenya', 'easy'),
('social_studies', 3, 'Our Environment', 'Which ocean borders Kenya to the east?', '["Atlantic Ocean","Pacific Ocean","Indian Ocean","Arctic Ocean"]', 'Indian Ocean', 'Kenya is bordered by the Indian Ocean on the east', 'easy'),
('social_studies', 3, 'Community', 'What do we call the leader of a county in Kenya?', '["President","Governor","Senator","Mayor"]', 'Governor', 'Each county in Kenya is headed by a Governor', 'easy'),
('social_studies', 3, 'Culture', 'Which community is known for the Maasai Mara?', '["Kikuyu","Luo","Maasai","Kalenjin"]', 'Maasai', 'The Maasai Mara is named after the Maasai community', 'easy'),
('social_studies', 3, 'Our Environment', 'What is the largest lake in Kenya?', '["Lake Nakuru","Lake Turkana","Lake Victoria","Lake Naivasha"]', 'Lake Victoria', 'Lake Victoria is the largest lake in Kenya and Africa', 'easy'),

-- SOCIAL STUDIES GRADE 5
('social_studies', 5, 'Governance', 'Who is the head of government in Kenya?', '["Governor","Prime Minister","President","Speaker"]', 'President', 'Kenya has a presidential system — the President is head of state and government', 'easy'),
('social_studies', 5, 'History', 'When did Kenya gain independence?', '["1960","1961","1962","1963"]', '1963', 'Kenya gained independence from Britain on 12 December 1963', 'medium'),
('social_studies', 5, 'Geography', 'Which is the highest mountain in Kenya?', '["Mt Elgon","Mt Longonot","Mt Kenya","Mt Kilimanjaro"]', 'Mt Kenya', 'Mt Kenya at 5,199m is the highest mountain in Kenya', 'easy'),
('social_studies', 5, 'Citizenship', 'What are the national colours of Kenya?', '["Red, White, Green","Black, Red, Green, White","Blue, White, Red","Green, Yellow, Black"]', 'Black, Red, Green, White', 'The Kenyan flag has black, red, green and white colours', 'easy'),
('social_studies', 5, 'Economy', 'What is the main cash crop grown in the Kenya Highlands?', '["Maize","Tea","Rice","Wheat"]', 'Tea', 'Tea is Kenya largest export crop grown mainly in the highlands', 'medium'),

-- GENERAL GRADE 4
('general', 4, 'General Knowledge', 'How many days are in a leap year?', '["364","365","366","367"]', '366', 'A leap year has 366 days — an extra day in February', 'easy'),
('general', 4, 'General Knowledge', 'Which planet is closest to the Sun?', '["Venus","Earth","Mars","Mercury"]', 'Mercury', 'Mercury is the closest planet to the Sun', 'easy'),
('general', 4, 'General Knowledge', 'How many sides does a hexagon have?', '["5","6","7","8"]', '6', 'A hexagon has 6 sides', 'easy'),
('general', 4, 'General Knowledge', 'What is the fastest land animal?', '["Lion","Horse","Cheetah","Leopard"]', 'Cheetah', 'A cheetah can run up to 120 km/h', 'easy'),
('general', 4, 'General Knowledge', 'Which continent is Kenya in?', '["Asia","Europe","Africa","South America"]', 'Africa', 'Kenya is a country in East Africa', 'easy');
