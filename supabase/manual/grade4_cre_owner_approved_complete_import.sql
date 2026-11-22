-- VibeSchool Grade 4 CRE: owner-approved curriculum import
-- Complete 35 entries / 129 specific learning outcomes.
-- Source: user-provided curriculum document; owner approved 2026-11-22.
-- No HQ approval dependency. Idempotent, transaction-scoped.
BEGIN;
CREATE TEMP TABLE cre_import_rows (
 code text, strand text, title text, lessons integer,
 sequence integer, outcomes text[]
) ON COMMIT DROP;
INSERT INTO cre_import_rows VALUES
('1.1','Creation','Self-awareness',2,1,ARRAY['a) mention his or her name for identification and self-awareness;','b) recognise his or her uniqueness as a creation of God;','c) acknowledge God as the creator;','d) appreciate his or her uniqueness as God’s special creation;']::text[]),
('1.2','Creation','Thoughts and feelings',3,2,ARRAY['a) identify good thoughts and feelings;','b) explain the importance of being joyful;','c) list lessons learnt from Ephesians 4:26;','d) apply the lessons learnt to cope with emotions in day-to-day life;']::text[]),
('1.3','Creation','Making choices',3,3,ARRAY['a) list choices they make in day-to-day life;','b) discuss results of choices they make in daily life;','c) make right choices guided by the word of God;','d) portray responsibility by making right choices;']::text[]),
('1.4','Creation','My Family — Family members',3,4,ARRAY['a) name family members in the nuclear and extended family;','b) draw a family tree to understand relationships within the family;','c) explain why it is important to honour parents;','d) respect family members for harmonious co-existence;']::text[]),
('1.5','Creation','Relationships within the Family',3,5,ARRAY['a) take care when alone with people of the opposite sex;','b) mention ways of protecting oneself from sexual abuse;','c) identify whom to report to if touched inappropriately or sexually abused;','d) appreciate the body as a temple of the Holy Spirit and live a holy life;']::text[]),
('1.6','Creation','Attributes of God',2,6,ARRAY['a) read scriptures on the attributes of God;','b) list three attributes of God and revere Him;','c) recognise God as a loving Father who knows them by their names;']::text[]),
('2.1','The Holy Bible','The Inspired Word of God',3,7,ARRAY['a) handle the Holy Bible with respect as the inspired word of God;','b) identify the books in the Old and New Testament;','c) role play naming some books in the Bible;','d) recite Isaiah 49:16 and desire to read the Holy Bible always;']::text[]),
('2.2','The Holy Bible','Zacchaeus the Tax Collector',3,8,ARRAY['a) retell the story of Zacchaeus;','b) recount how Zacchaeus changed his behaviour positively;','c) demonstrate integrity when using money;','d) discuss why it is important to repent sins in order to be like Christ;']::text[]),
('2.3','The Holy Bible','Balaam’s Donkey',3,9,ARRAY['a) retell the story of Balaam and his donkey;','b) apply the story in their lives by obeying God’s instructions;','c) acquire the value of love by speaking good things about others;','d) acknowledge God’s greatness by revering Him;']::text[]),
('2.4','The Holy Bible','Samson kills a Lion',2,10,ARRAY['a) retell the story of Samson; Judges 14:5–9;','b) acknowledge God’s power in his or her life;','c) trust in God to cope with the challenges of life;']::text[]),
('2.5','The Holy Bible','Joseph interprets a Dream',3,11,ARRAY['a) retell the story of Joseph interpreting a dream;','b) apply lessons learnt by depending on God’s wisdom;','c) recognise that the fear of God is the beginning of wisdom;']::text[]),
('2.6','The Holy Bible','Bible Patriarchs — Abraham',2,12,ARRAY['a) recount the call of Abraham;','b) obey God’s instructions in his or her day-to-day life;','c) mention his or her name for self-identity;','d) discuss Abram’s change of name to Abraham;','e) appreciate God’s blessings in his or her life;']::text[]),
('3.1','The Life of Jesus Christ','The Annunciation',3,13,ARRAY['a) narrate the annunciation of the birth of Jesus Christ;','b) acknowledge the uniqueness of the birth of Jesus Christ;','c) recite Luke 1:37 and trust in God’s power;','d) emulate Mary the mother of Jesus and lead a holy life;']::text[]),
('3.2','The Life of Jesus Christ','Birth of John the Baptist',2,14,ARRAY['a) retell the birth of John the Baptist;','b) discuss how John the Baptist prepared the way for the Messiah;','c) appreciate the need to live a righteous life by turning away from sins;']::text[]),
('3.3','The Life of Jesus Christ','Healing of Blind Bartimaeus',3,15,ARRAY['a) retell the healing of blind Bartimaeus;','b) recognise the healing power of Jesus Christ in their lives;','c) appreciate Jesus’ power over sickness and disease;']::text[]),
('3.4','The Life of Jesus Christ','Healing the 10 Lepers',3,16,ARRAY['a) narrate the story of the 10 lepers;','b) outline ways of showing gratitude to God in day-to-day life;','c) express gratitude to those who show them kindness;','d) appreciate the miracle by having faith in God;']::text[]),
('3.5','The Life of Jesus Christ','Jesus raises a Widow’s Son',2,17,ARRAY['a) retell the story of raising the widow’s son;','b) recognise God’s power over life and death;','c) apply lessons learnt by showing compassion to others;','d) pray to God when faced with challenges;']::text[]),
('3.6','The Life of Jesus Christ','Forgiveness',2,18,ARRAY['a) outline the importance of forgiving others;','b) resist vengeance as outlined in Matthew 5:39;','c) appreciate forgiveness by not repaying evil for evil;']::text[]),
('3.7','The Life of Jesus Christ','Helping the Needy',2,19,ARRAY['a) state the importance of helping the needy;','b) demonstrate kindness by sharing with those in need;','c) recite Matthew 5:42 and help those in need promptly;']::text[]),
('3.8.1','The Life of Jesus Christ','Parable of the lost coin',2,20,ARRAY['a) retell the parable of the lost coin;','b) list lessons learnt from the parable of the lost coin;','c) recognise God’s love for the sinner and the need to live a righteous life;','d) appreciate God’s love and lead upright lives;']::text[]),
('3.8.2','The Life of Jesus Christ','Parable of the mustard seed',3,21,ARRAY['a) retell the parable of the mustard seed as guided by the Bible text;','b) describe how the kingdom of God grows from a small beginning;','c) explain how they contribute to the growth of the kingdom of God;','d) appreciate the growth of God’s kingdom by evangelising to others;']::text[]),
('3.9','The Life of Jesus Christ','Nicodemus’ encounter with Jesus Christ',3,22,ARRAY['a) retell the story of Nicodemus’ encounter with Jesus Christ;','b) acknowledge that repentance of sins draws us close to Christ;','c) discuss the importance of baptism to Christians today;','d) recite John 3:16 and believe in Jesus Christ to inherit eternal life;']::text[]),
('4.1','Christian Values','Trust',3,23,ARRAY['a) emulate Joseph by resisting sexual temptations as young people;','b) exercise assertiveness in the face of temptations/tempting situations;','c) identify people he/she can trust for own safety;','d) recite Psalm 125:1 and trust in God always;']::text[]),
('4.2','Christian Values','Truthfulness',3,24,ARRAY['a) state the importance of telling the truth;','b) resist lying as cited in Proverbs 12:19;','c) desire to always speak the truth according to Ephesians 4:25;']::text[]),
('4.3','Christian Values','Obedience',3,25,ARRAY['a) read Exodus 20:12 and state the benefit of honouring parents;','b) obey parents and teachers to promote harmonious co-existence;','c) practise responsibility by obeying school rules;','d) outline the results of disobedience;','e) desire to exercise obedience in day-to-day life;']::text[]),
('4.4','Christian Values','Love',3,26,ARRAY['a) recognise that God loves children; Matthew 19:13–15;','b) demonstrate love by showing kindness to others;','c) appreciate God’s love by obeying His teachings;']::text[]),
('4.5','Christian Values','Responsibility — Personal and school items',2,27,ARRAY['a) identify personal items and how they care for them;','b) identify school properties and how they care for them;','c) acquire responsibility by taking care of personal and school properties;']::text[]),
('4.6','Christian Values','Holiness',4,28,ARRAY['a) describe ways of glorifying God with their bodies;','b) acquire the value of holiness by keeping away from situations that lead to sin;','c) recite 1 Corinthians 6:19 on the body as the temple of the Holy Spirit;','d) desire to lead holy lives free from sin;']::text[]),
('5.1','The Church','House of God',2,29,ARRAY['a) outline lessons learnt from Matthew 21:12–14;','b) participate in church activities to grow spiritually;','c) appreciate the church as a house of worship;']::text[]),
('5.2','The Church','The Early Church',3,30,ARRAY['a) name the disciples of Jesus Christ;','b) describe how the early church was started;','c) desire to turn away from sins according to Acts 2:38;']::text[]),
('5.3','The Church','Standing Firm in Faith',3,31,ARRAY['a) name the city where believers were first called Christians;','b) retell how Stephen was stoned for standing firm in his faith;','c) list three lessons learnt from the stoning of Stephen;','d) explain why they should not join ungodly groups;','e) utilise the virtue of assertiveness and stand firm in faith;']::text[]),
('5.4','The Church','The Lord’s Prayer',3,32,ARRAY['a) recite the Lord’s prayer;','b) pray for parents, guardians and friends;','c) say a prayer to God every day to grow spiritually;']::text[]),
('5.5','The Church','Fruit of the Holy Spirit',3,33,ARRAY['a) list the fruit of the Holy Spirit; Galatians 5:22–23;','b) describe how they apply the fruit of the Holy Spirit in their lives;','c) desire to be led by the Holy Spirit in their daily activities;']::text[]),
('5.6','The Church','Self-control',2,34,ARRAY['a) practise self-control as guided in Galatians 5:23–25;','b) make right decisions that are guided by the Holy Spirit;','c) demonstrate self-control by avoiding behaviour that defiles the body;','d) live Godly lives guided by the Holy Spirit;']::text[]),
('6.1','Morality and Social Media','Use of Social Media',2,35,ARRAY['a) list digital devices used at home and school;','b) discuss appropriate ways of using social media;','c) apply the value of integrity when using social media;','d) desire to do the right thing always even when no one is watching;']::text[]);
DO $$
BEGIN
 IF (SELECT count(*) FROM cre_import_rows) <> 35 OR
    (SELECT sum(cardinality(outcomes)) FROM cre_import_rows) <> 129 THEN
  RAISE EXCEPTION 'CRE import completeness failed';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id='8165d513-035b-4019-9fdb-5b86a27335a1' AND name='Christian Religious Education') THEN
  RAISE EXCEPTION 'CRE subject identity not verified';
 END IF;
END $$;
-- Preserve any existing rows; insert only missing Grade 4 CRE entries.
INSERT INTO public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,learning_outcomes,source_ref)
SELECT '8165d513-035b-4019-9fdb-5b86a27335a1'::uuid,
       'Grade 4',r.strand,r.code||' '||r.title,
       split_part(r.code,'.',1)::integer,r.sequence,r.outcomes,
       'owner-approved:grade4-cre:2026-11-22'
FROM cre_import_rows r
WHERE NOT EXISTS (
 SELECT 1 FROM public.cbc_strands s
 WHERE s.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
 AND s.grade='Grade 4' AND s.sub_strand=r.code||' '||r.title
);
-- Synchronize outcomes of matching records with the owner-approved source.
UPDATE public.cbc_strands s
SET learning_outcomes=r.outcomes, source_ref='owner-approved:grade4-cre:2026-11-22'
FROM cre_import_rows r
WHERE s.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
 AND s.grade='Grade 4' AND s.sub_strand=r.code||' '||r.title;
-- Add searchable outcome rows with explicit curriculum linkage.
INSERT INTO public.curriculum_learning_outcomes
 (sub_strand_id,outcome_text,outcome_code,source_type,source_ref,status,source_locator)
SELECT s.id, o.outcome, r.code||'.'||o.ordinality::text,
 'publisher','owner-approved:grade4-cre:2026-11-22','active',
 'Grade 4 CRE / '||r.code
FROM cre_import_rows r
JOIN public.cbc_strands s
 ON s.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
 AND s.grade='Grade 4' AND s.sub_strand=r.code||' '||r.title
CROSS JOIN LATERAL unnest(r.outcomes) WITH ORDINALITY AS o(outcome,ordinality)
WHERE NOT EXISTS (
 SELECT 1 FROM public.curriculum_learning_outcomes existing
 WHERE existing.sub_strand_id=s.id AND existing.outcome_text=o.outcome
);
DO $$
DECLARE n integer; m integer;
BEGIN
 SELECT count(*) INTO n FROM public.cbc_strands
 WHERE subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
 AND grade='Grade 4' AND source_ref='owner-approved:grade4-cre:2026-11-22';
 SELECT count(*) INTO m FROM public.curriculum_learning_outcomes o
 JOIN public.cbc_strands s ON s.id=o.sub_strand_id
 WHERE s.subject_id='8165d513-035b-4019-9fdb-5b86a27335a1'::uuid
 AND s.grade='Grade 4'
 AND o.source_ref='owner-approved:grade4-cre:2026-11-22';
 IF n<>35 OR m<>129 THEN
  RAISE EXCEPTION 'CRE import failed post-check: entries %, outcomes %',n,m;
 END IF;
END $$;
COMMIT;
