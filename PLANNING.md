I want to work on the new user experience.

1. I want to have a special first lesson that is meant to capture the user's name. I want it to be in a conversational (speech bubble) style, where Sona talks to the user. Just like with the speech bubbles at the top of the page, the large text will be in romanized nepali, with smaller english below. Use the same styles as the ones used on the main page. The conversation goes like this (translate all of this to nepali, of course; the parts in parentheses are just directions, don't show that in the UI):

      Sano: What is your name?  
       User: My name is [__________]. (input field here; we'll limit this to 16 characters)

      [ ENTER ] (button at the bottom to save the user name)

Next, we'll explain how the app works:

    Sano: Nice to meet you, $NAME!
    Sano: I'll save your progress for you.
    User: Thank you, Sano.

We'll ask the user if they want to create an account:

    Sano: Would you like me to also save your progress to the cloud?
    Sano: This is optional.
    User: Yes please. (A user would select this one or the next one)
    User: Not right now.

If they select "Not right now" at any time, including in the branches below:

    Show a celebration screen, with a message like "Set up complete! Time to learn." When they click the [ CONTINUE ] button, it takes them to the main lesson screen. The new user experience is over.

If they select "Yes please":

    Sano: I'll need a username and a password.
    User: My username is [__________] and my password is [__________].

Next: Create a new account for them on the server; we'll need a new API endpoint for this.

    Sano: If you save this app to your home screen, I can remind you daily to complete a lesson.
    Sano: Should I show you how to do that?
    User: Yes please. (A user would select this one or the next one)
    User: Not right now.

Next: Show a simple diagram of how to save a PWA to their homescreen. At the bottom is [ CONTINUE ]. Once clicked:

    Show a celebration screen, with a message like "Set up complete! Time to learn." When they click the [ CONTINUE ] button, it takes them to the main lesson screen. The new user experience is over.

2. We'll need a new API endpoint to create user accounts. Give me advice on best practices for keeping this safe.

3. If a user logs in on the PWA version and doesn't have a reminder set up, we should ask them via a modal on the main page if they want to configure it, and what time it should go off. It should ask for both time and timezone. We should limit it to just whole number hours (i.e. 7:00pm, not 7:02pm) so that our crontab only has to fire off 24 times a day.

4. We need an endpoint to save reminder times, and an updated crontab entry to run every hour.
