# Pedagogy — How sano should teach

A working reference for the learning-science and second-language-acquisition (SLA)
research behind a phrase-based study app, written specifically for **sano**: an app
that teaches **practical, conversational Nepali phrases** with Romanized
pronunciations. Each principle below states the idea, the evidence (a named
researcher and a link), and a concrete **Apply it in sano** note.

This is an internal design reference, not a content spec — Ross owns the phrase
content and the Romanized-Nepali drafts. Treat the "Apply it in sano" notes as
opportunities, not corrections.

> **TL;DR.** Teach the *high-frequency phrases people actually say*, as whole
> *chunks*, inside *comprehensible context*; make the learner *produce them out
> loud from memory*; *space and interleave* the reviews; and wrap it all in a
> *small daily habit* with a well-timed prompt. Phrases first, recall over
> recognition, audio over transliteration alone, little-and-often over cramming.

---

## 1. Teach the language people actually speak (high-frequency, functional first)

A small set of words and set phrases does most of the work in real conversation.
Paul Nation's corpus research found that the **most frequent ~2,000 word families
cover roughly 89–96% of everyday spoken language** (higher for informal speech);
3,000 families plus proper nouns reach ~96% of the Wellington Corpus of Spoken
English. The practical lesson: prioritize by frequency and communicative payoff,
not by what's easy to list.

This dovetails with **Communicative Language Teaching (CLT)** and **Task-Based
Language Teaching (TBLT)**, which organize learning around *doing things with
language* — greeting, ordering, asking directions, bargaining — rather than
memorizing grammar rules. The CEFR and ACTFL "**can-do** statements" express
exactly this: progress measured as "I can order a meal," "I can ask how much
something costs."

- **Experts:** Paul Nation (Victoria University of Wellington); Council of Europe
  (CEFR); ACTFL.
- **Apply it in sano:** Order and group phrases by *situation and frequency*
  (greetings → numbers/money → food → directions → small talk), so the earliest
  lessons unlock the most real conversations. Frame each lesson as a can-do goal
  ("After this you can greet someone and ask their name") rather than a word list.

## 2. Teach phrases as chunks, not words to be assembled (the lexical approach)

Michael Lewis's **Lexical Approach** (1993) argues that "language consists of
grammaticalized lexis, not lexicalized grammar" — fluent speech is built from
ready-made **chunks**, **collocations**, and fixed expressions stored and retrieved
as single units. Treating a phrase as one unanalyzed whole lets the learner
produce it fast, without assembling it word-by-word under time pressure — which is
precisely what conversation demands.

- **Expert:** Michael Lewis, *The Lexical Approach*.
- **Apply it in sano:** This is already sano's core model, and it's the right one
  — keep the unit of learning the **whole useful phrase** ("dhanyabād" /
  "tapāī̃lāī kasto cha?"), not isolated vocabulary to be conjugated. Where a phrase
  has a swappable slot ("My name is ___"), teach the frame as a chunk with the
  slot, so learners reuse the pattern.

## 3. Make the input comprehensible and contextual

Stephen Krashen's **Input Hypothesis** holds that we acquire language by
understanding messages slightly beyond our current level — "**i+1**" — when anxiety
is low (a low "**affective filter**"). The takeaway for an app: every new phrase
should arrive *understandable in context* (paired with meaning, a picture, or a
situation), one comfortable step beyond what the learner already knows, in a
friendly, low-pressure frame.

Input alone isn't the whole story (see §4), but comprehensible, contextual input
is the foundation everything else builds on.

- **Expert:** Stephen Krashen, *Principles and Practice in Second Language
  Acquisition*.
- **Apply it in sano:** sano's speech-bubble Sano dialogues already deliver phrases
  *in a conversational context* with English support — keep that. Introduce new
  phrases against ones already known, and keep the tone warm (the mascot, the
  encouraging copy) to keep the affective filter low.

## 4. Make learners produce — early, and out loud (output, not just input)

Merrill Swain's **Output Hypothesis** came from French-immersion students who, after
years of rich input, understood almost everything but still couldn't *speak*
accurately. Producing language ("**pushed output**") forces learners to notice gaps,
test what they know, and consolidate it. Speaking and writing aren't just proof of
learning — they *cause* it.

The Pimsleur method operationalizes this with the **Principle of Anticipation**:
instead of "repeat after me," it prompts you to *recall and produce* a phrase before
revealing the answer — the same active "challenge-and-response" that real
conversation requires.

- **Experts:** Merrill Swain (output hypothesis); Paul Pimsleur (anticipation).
- **Apply it in sano:** Bias exercises toward **production**: prompt the English (or
  the situation) and ask the learner to produce the Nepali from memory *before*
  showing it, rather than only recognizing the right option. Where feasible, invite
  saying it **aloud** (even an un-graded "now say it" beat builds the speaking
  habit). The quiz/flashcard direction matters — English→Nepali recall is harder and
  more valuable than Nepali→English recognition.

## 5. Practice by recalling, not re-reading (retrieval practice / the testing effect)

Roediger & Karpicke's classic experiments showed that **taking a test on material
beats re-studying it** for long-term retention — the "**testing effect**." Restudy
felt more effective and even won at a 5-minute delay, but at 2 days and 1 week the
*tested* group remembered far more. The act of pulling an answer from memory
strengthens it; passively reviewing does not.

- **Experts:** Henry Roediger & Jeffrey Karpicke, "Test-Enhanced Learning,"
  *Psychological Science* (2006).
- **Apply it in sano:** Flashcards and quizzes should be the *main* study mode, not
  a check at the end. Make the learner attempt recall **before** the answer shows
  (flip-after-guess, not answer-first). A phrase the learner struggled to recall and
  then got is worth more than one they merely re-read.

## 6. Space and interleave the reviews (spaced repetition + desirable difficulties)

Hermann Ebbinghaus's 1885 **forgetting curve** showed memory decays sharply within
hours-to-days without review. The fix is **spaced repetition**: review each item at
*expanding* intervals, timed for just before you'd forget it. Piotr Woźniak turned
this into the **SuperMemo** algorithm (1985–87), now the engine behind **Anki**,
Mnemosyne, and most modern study apps; Pimsleur's "**graduated interval recall**" is
the same idea in audio form.

Robert & Elizabeth Bjork frame spacing — along with **interleaving** (mixing topics
rather than blocking them) and retrieval — as "**desirable difficulties**": they feel
harder and slower in the moment but produce more durable, flexible knowledge. Spaced
practice alone often *doubles* long-term retention versus massed practice for the
same total study time.

- **Experts:** Ebbinghaus (forgetting curve); Piotr Woźniak (SuperMemo / spaced
  repetition); Robert Bjork (desirable difficulties).
- **Apply it in sano:** Schedule **review of already-learned phrases at growing
  intervals** (today → tomorrow → 3 days → a week …), promoting items the learner
  gets and resurfacing ones they miss — a lightweight SRS layered on the existing
  progress tracking. **Interleave** phrases across topics in review sessions rather
  than always drilling one lesson in a block, and vary the prompt direction. The
  daily reminder (next section) is spacing at the *session* level.

## 7. Build a small daily habit with a well-timed prompt

BJ Fogg's **Behavior Model** says a behavior happens only when **Motivation,
Ability, and a Prompt** converge at the same moment (**B = MAP**). For a study app
that means: keep each session *small and frictionless* (Ability), make it *feel
good* (Motivation), and *prompt it at the right time* (Prompt). Tiny, consistent
sessions beat occasional marathons — and they're what spacing (§6) needs anyway.

This is also the strongest argument for app-based learning generally: a peer-reviewed
**Duolingo efficacy study** (*Foreign Language Annals*) found self-study learners
reached reading/listening proficiency *comparable to four university semesters* in
less than half the time — though their **listening lagged their reading**, a direct
warning that passive tapping under-builds the *ear* and the *mouth* (see §4 and §8).

- **Experts:** BJ Fogg (Behavior Model / *Tiny Habits*, Stanford); Duolingo
  efficacy research.
- **Apply it in sano:** sano already has the pieces — the **daily push reminder**
  (Prompt), short **offline-capable lessons** (Ability), and the **lesson-complete
  celebration / streak-like progress** (Motivation). Keep the daily unit *small*
  (a handful of phrases), fire the reminder at the user's chosen hour, and reward
  completion. The "studied today" check that gates the reminder is exactly the right
  habit-loop instinct — don't nag someone who already showed up.

## 8. Treat Romanization as a bridge — give the ear a real model

Romanized pronunciation lowers the entry barrier (no script to learn first), which
is great for getting beginners *speaking* fast. But transliteration can only
approximate sounds a learner's first language doesn't have, and the Duolingo finding
(§7) shows listening is the skill most likely to lag in self-study. Pimsleur's whole
method is **audio-first** for this reason: you must *hear* a native model and *say it
back* to build comprehension and an intelligible accent.

- **Experts:** Paul Pimsleur (audio-first, anticipation); Duolingo efficacy
  (listening gap).
- **Apply it in sano:** The Romanized strings (Ross's drafts) are a fine *bridge* —
  keep them. The high-leverage future add is **native-speaker audio** for each
  phrase, so learners hear the real sound and can shadow it, with the Romanization
  as a reading aid rather than the only pronunciation guide. (Not a critique of the
  transliterations — audio *complements* them.)

## 9. Show progress in real-world "can-do" terms, and protect motivation

Self-Determination research and the CEFR/ACTFL framing agree that learners persist
when they feel **competent**, **autonomous**, and like they're achieving *real* goals.
"You can now have this conversation" motivates more than "you reviewed 20 cards."
Krashen's low-affective-filter point applies here too: encouragement and a sense of
progress keep anxiety down and learners coming back.

- **Experts:** CEFR / ACTFL can-do framing; Krashen (affective filter).
- **Apply it in sano:** Express progress as **unlocked conversations / situations**
  ("You can order food," "You can introduce yourself"), not just counts. Celebrate
  milestones, keep failure low-stakes (retry, no penalty), and let the learner steer
  (choose topics, set their own reminder time — which sano already does).

---

## Quick reference: principle → sano

| Principle | Research anchor | In sano today | Opportunity |
|---|---|---|---|
| High-frequency, functional first | Nation; CEFR/ACTFL | Essential-phrase content | Order by frequency + situation; can-do lesson goals |
| Phrases as chunks | Lewis (lexical approach) | **Core model already** | Teach frames with swappable slots |
| Comprehensible, contextual input | Krashen (i+1) | Speech-bubble Sano dialogues | New phrase built on known ones |
| Produce early & aloud | Swain; Pimsleur | Quiz / flashcards | Recall-before-reveal; "say it aloud" beat |
| Retrieval over re-reading | Roediger & Karpicke | Flashcards, quiz | Make recall the main mode, guess-then-flip |
| Space & interleave | Ebbinghaus; Woźniak; Bjork | Daily reminder (session spacing) | SRS scheduling of learned phrases; mix topics |
| Small daily habit | Fogg (B=MAP) | Reminder + short lessons + celebration | Keep units tiny; reward streaks |
| Audio model, not just Roman | Pimsleur; Duolingo gap | Romanized pronunciations | Add native-speaker audio to shadow |
| Real-world progress | CEFR/ACTFL; Krashen | Progress stats | Frame progress as unlocked conversations |

---

## References

**Vocabulary & what to teach**
- Paul Nation — high-frequency vocabulary & coverage; BNC/COCA word-family lists:
  <https://www.eapfoundation.com/vocab/general/bnccoca/> · Nation & Waring (1997),
  "Vocabulary size, text coverage and word lists":
  <https://www.lextutor.ca/research/nation_waring_97.html>
- CEFR illustrative descriptors (Council of Europe):
  <https://rm.coe.int/chapter-5-communicative-language-competences/1680a084c3> ·
  NCSSFL-ACTFL Can-Do Statements:
  <https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements>
- Task-Based Language Teaching (overview):
  <https://en.wikipedia.org/wiki/Task-based_language_teaching>

**Chunks & input**
- Michael Lewis, *The Lexical Approach* — review & summary (TESL-EJ):
  <https://tesl-ej.org/wordpress/issues/volume1/ej02/ej02r3/> · overview:
  <https://www.myenglishpages.com/lexical-approach/>
- Stephen Krashen, *Principles and Practice in Second Language Acquisition* (full
  PDF): <https://www.sdkrashen.com/content/books/principles_and_practice.pdf> ·
  theory summary: <https://www.sk.com.br/sk-krash-english.html>

**Output & speaking**
- Merrill Swain — Output Hypothesis (overview):
  <https://en.wikipedia.org/wiki/Comprehensible_output> · bio:
  <https://en.wikipedia.org/wiki/Merrill_Swain>
- Paul Pimsleur — Principle of Anticipation & graduated interval recall:
  <https://www.pimsleur.com/blog/why-graduated-interval-recall-is-the-key-to-mastering-a-new-language>
  · method writeup: <https://artofmemory.com/blog/the-pimsleur-language-method/>

**Memory: retrieval & spacing**
- Roediger & Karpicke (2006), "Test-Enhanced Learning," *Psychological Science*:
  <https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x>
- Spaced repetition history (Ebbinghaus → Woźniak / SuperMemo → Anki):
  <https://supermemo.guru/wiki/History_of_spaced_repetition_(print)> · SuperMemo
  method: <https://www.supermemo.com/en/supermemo-method>
- Robert & Elizabeth Bjork — desirable difficulties (UCLA Learning & Forgetting
  Lab): <https://bjorklab.psych.ucla.edu/research/> · Bjork & Bjork (2011),
  "Making things hard on yourself, but in a good way":
  <https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf>

**Habit & app efficacy**
- BJ Fogg — Behavior Model (B = MAP): <https://www.behaviormodel.org/> ·
  *Tiny Habits*: <https://www.bjfogg.com/>
- Duolingo efficacy research (reading/listening outcomes vs. university classes):
  <https://www.duolingo.com/efficacy/studies> · whitepaper:
  <https://duolingo-papers.s3.amazonaws.com/reports/duolingo-efficacy-whitepaper.pdf>

---

*Compiled 2026-06-18. Sources are summarized for design guidance; follow the links
for primary research. Pedagogy and phrase content remain Ross's call.*
