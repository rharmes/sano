# Conversation scripts — English working draft

Rewrite these freely to be funnier. Keep the **speaker labels**; add, cut, or reorder lines
as you like, and rework the questions too. When you are done, I will map each English line
back to a Nepali course phrase — reusing existing ones and drafting new course items where a
line needs a phrase we do not teach yet — then we render audio.

**Voice-acting tags:** drop ElevenLabs v3 performance tags in `[square brackets]` right into a
line wherever you want them — e.g. `PYARO: [shouting] GO AWAY!` or `SANO: [sarcastic] Works for
me.` (tag list: elevenlabs.io/blog/v3-audiotags). I'll carry them into the Nepali line's audio so
the TTS performs them; they never show in the app or affect the translation.

## Workflow — this file is the source of truth

This MD is **canonical** for the conversations' English: the story, speaker order, the comprehension
questions, per-dialogue metadata (title / cast / anchor unit / goal), and voice direction (CAPS
emphasis and `[tags]`). `js/dialogues.js` (the runtime `DIALOGUES`) is **built from it by hand**,
adding what the MD doesn't carry: the Nepali (`np` / `dev` / per-word `gloss`), audio-clip routing,
and the path `section`.

**When you edit a line, question, or the order here, re-map the matching `js/dialogues.js` entry and
re-render any changed audio** (`synth-app.mjs --dialogues --only <clipId>`, then bump
`AUDIO_VERSION`). Nothing enforces this automatically — keep the two in sync by hand.

_Internal-only — `tools/` is not deployed._

---

## 1. Meeting Pyaro  —  Sano & Pyaro
_Pyaro: a warm red panda who gets thrilled about the littlest things._  
Anchored after: **Introductions** · goal: Greet someone and make small talk

NARRATOR: A narrow road along a deep canyon. Pyaro leans over the edge. Sano walks up beside him.
PYARO: Someone down there keeps copying me! Listen. GO AWAY!
NARRATOR: The canyon answers quietly — go away... away...
PYARO: See? It mocks me!
SANO: That's an echo. The canyon repeats your own voice.
PYARO: ...An echo.
SANO: Try it. Say something nice.
PYARO: I AM MAGNIFICENT!
NARRATOR: The canyon replies, clear as a bell — no you're not.
PYARO: See? You try.
SANO: THIS CANYON IS GREAT.
NARRATOR: The canyon replies - this canyon is great... great...
SANO: Works for me.

**Questions**
1. What does Pyaro first shout to the canyon?
   - Go away  ✓
   - Hello
   - How are you?
   - Echo
2. Why is Pyaro upset?
   - He thinks someone is mocking him  ✓
   - He doesn't understand the voice
   - He doesn't want to see Sano
   - He is scared of heights
3. What does Sano call the canyon?
   - Great  ✓
   - Tired
   - Pretty
   - Small

---

## 2. Encounter with Gyani  —  Sano & Gyani
_Gyani: a wise elder elephant — full of advice, and always somewhere to be._  
Anchored after: **Meals** · goal: Offer food and tea, and react to a meal

NARRATOR: A quiet road through tall grass. Gyani stands frozen, trunk raised, deep in thought. Sano scampers up to her foot.
SANO: You're blocking the entire road.
GYANI: Patience, little one. I remember something vital. And elephants never forget.
SANO: Never?
GYANI: Never. I know every star, every river, every tree.
SANO: Impressive. So what's the vital thing?
GYANI: ...That is what I'm trying to remember.
SANO: Maybe it's where you're headed?
GYANI: No, no. It's something I'm supposed to fear. A tiny creature. Furry. Whiskers.
SANO: ...Furry. Whiskers.
GYANI: It squeaks! Horrid little thing — you ever see one?
NARRATOR: Sano looks down at her own paws, then back up.
SANO: Nope. Never. Good luck with that.

**Questions**
1. Why can't Sano go down the road?
   - Gyani is blocking it  ✓
   - A tree has fallen
   - A monster is blocking it
   - Sano is lost
2. Why is Gyani standing in the road?
   - She is trying to remember something  ✓
   - She is tired
   - She is lost
   - She is hungry
3. What is Gyani afraid of?
   - Mice  ✓
   - Snakes
   - Tigers
   - Birds

---

## 3. A toll from Shanta  —  Sano & Shanta
_Shanta: a calm, soft-spoken yak who means every word._  
Anchored after: **Household Living** · goal: Pitch in around the house

NARRATOR: A muddy road over a mountain pass. Shanta walks along, chewing slowly. Sano jumps onto his back.
SANO: A payment, friend! This road is mine. You owe me one nut.
SHANTA: ...Okay.
SANO: Excellent. Give it to me.
SHANTA: Give you what?
SANO: The nut. The payment. So that you can use this road.
SHANTA: What road?
SANO: This road! Under your feet! Focus!
SHANTA: My feet?
NARRATOR: Sano sighs and slaps her own forehead.
SANO: Forget the nut. Just keep walking. To the village.
SHANTA: To where?
SANO: I give up. You win.
NARRATOR: Sano jumps off of Shanta and walks away, shaking her head.

**Questions**
1. What is Shanta doing when Sano arrives?
   - Walking  ✓
   - Sleeping
   - Thinking
   - Watching
2. What does Sano ask for?
   - A nut  ✓
   - A seed
   - Some grain
   - Some water
3. Why does Sano give up?
   - Shanta is too confused  ✓
   - Shanta is angry
   - Shanta falls asleep
   - Shanta runs away

---

## 4. Scaring Bahadur  —  Sano & Bahadur
_Bahadur: an easygoing tiger who runs the corner shop and loves to haggle._  
Anchored after: **Purchasing** · goal: Ask the price and bargain

NARRATOR: A sunlit road through the jungle. Bahadur crouches low, eyes locked on Sano. Sano sits calmly, cleaning his whiskers.
BAHADUR: A snack delivers itself to me. Hello little one.
SANO: Eat me? You don't know who I am. Every animal in this jungle fears me.
BAHADUR: Fears you? A mouse?
SANO: Walk behind me. Watch them run. Then decide if I'm a snack.
BAHADUR: Fine. Amuse me.
NARRATOR: Sano struts down the road. Bahadur prowls a step behind. A deer spots them and bolts. Then a snake. Then a flock of birds explodes from the trees.
SANO: See? They are all afraid of me.
BAHADUR: They run from you?
SANO: Every single time.
BAHADUR: My apologies, great one. I didn't know. Please, don't hurt me.
NARRATOR: Bahadur turns and vanishes. Sano waves goodbye to the only animal in the jungle who doesn't think to look behind her.

**Questions**
1. What does Bahadur want to do?
   - Eat  ✓
   - Sleep
   - Scare other animals
   - Run
2. Why are the animals afraid?
   - They see a tiger  ✓
   - They see a mouse
   - They have somewhere to be
   - They are lost
3. What does Bahadur call Sano at the end?
   - Great one  ✓
   - Little one
   - Furry one
   - Scary one

---

## 5. Hiding with Rangin  —  Sano & Rangin
_Rangin: a dazzling danphe whose mind flits from one shiny thing to the next._  
Anchored after: **Emotions & Feelings** · goal: Talk about how you feel

NARRATOR: A rocky mountain road. Rangin crouches behind one thin tree, utterly still, feathers full of color. Sano walks up.
SANO: ...What are you doing?
RANGIN: Hiding. A hawk circles above. But I am a master of camouflage.
SANO: You glow like a sunset. I can see you from the next valley.
RANGIN: Nonsense. I blend perfectly with my surroundings.
SANO: Your surroundings are grey rock. You are... not grey.
RANGIN: Exactly! Who expects a rainbow on a grey rock? Genius.
SANO: That's not how hiding works.
RANGIN: The hawk still circles, yes? She doesn't dive. My method works.
NARRATOR: Sano glances up. The hawk hangs directly overhead, motionless, beak slightly open.
SANO: She doesn't dive because she's stunned. You're the prettiest thing she has ever seen.
RANGIN: So my plan works perfectly!

**Questions**
1. What is Rangin doing?
   - Hiding  ✓
   - Eating
   - Flying
   - Walking
2. Why is it so hard for Rangin to hide?
   - He's very colorful  ✓
   - He's very loud
   - He can't stay still
   - He's so big
3. Why doesn't the hawk attack?
   - She thinks Rangin is pretty ✓
   - She thinks Rangin doesn't taste good
   - She can't see Rangin
   - She's too busy

---

## 6. Thulo's stand-off
_Thulo: a grand old rhino who narrates ordinary life like an epic._  
Anchored after: **Verbs: Past tense** · goal: Tell someone what you did, in the past tense

NARRATOR: A dusty road through tall grass. Thulo stands still in the middle, horn lowered at a small thornbush. Sano pokes her head out of the grass.
SANO: Why are you threatening a bush?
THULO: That is no bush. That is my enemy. He never once blinks.
SANO: Rhinos have terrible eyesight, you know.
THULO: Nonsense. I see perfectly. The villain even copies my horn.
SANO: Those are thorns. It's a plant. It can't move.
THULO: ...He holds very still.
SANO: Because it's a shrub.
THULO: A clever trick. He waits for me to tire.
NARRATOR: Sano sighs and flicks a pebble. The leaves rustle.
THULO: HE MOVES! Stand back, mouse — I CHARGE!
NARRATOR: Thulo lowers his horn and charges into the grass — in entirely the wrong direction.
SANO: The bush is behind you!
NARRATOR: A long pause. Then the thornbush leans over and whispers.
THORNBUSH: ...Is he gone? I been holding my breath since Tuesday.

**Questions**
1. Why was Thulo staring at a bush?
   - He thought it was his enemy  ✓
   - He wanted to eat it
   - He was stuck on a thorn
   - He was asleep
2. Why did Thulo charge?
   - Sano made a leaf move  ✓
   - He saw another animal
   - He was tired of waiting
   - He had somewhere to be
3. Why was the thornbush relieved?
   - It was holding it's breath  ✓
   - It didn't want to be eaten
   - It noticed rain
   - It was scared of Sano
