Staking on Planets
-------------------

> a.k.a. Claiming planets and make them produce spaceship for you

- Select planet
- Perform transaction to claim with Etherplay token
- Wait for tx to be mined
- Tx mined => it is your planet, allow acknowledgement ?
- tx failed => show failure, acknowledge
- tx never mined => show timeout, acknowledge/retry, accept it can happen later if not overriden with another tx (could propose to send a null tx to cancel it)


Sending Spaceships
------------------

- Select origin planet and destination planet
- Select amount of planet, see prediction of combat
- confirm
- be warned of the second tx needed
- See fleet and show that tx is pending
- tx is mined, fleet is on its way for good
- tx failed => show failure, acknowledge
- tx never mined => show timeout, acknowledge/retry, accept it can happen later if not overriden with another tx (could propose to send a null tx to cancel it)
- show arrival
- show when reveal tx is possible
- if too late, show that => (can we deal with return spaceships ?)
- allow to resolve, choose friendly send or attack choice
- show that resolution is pending
- resolution mined: show result, allow acknowledgement
- tx failed => show failure, acknowledge
- tx never mined => show timeout, acknowledge/retry, accept it can happen later if not overriden with another tx (could propose to send a null tx to cancel it)


Exit Planet
-----------

- Select Planer
- perform tx to exit
- show exit pending...
- tx mined: show exit started for good
- tx failed => show failure, acknowledge
- tx never mined => show timeout, acknowledge/retry, accept it can happen later if not overriden with another tx (could propose to send a null tx to cancel it)
- show progress
- exit done, acknowledged => show withdraw balance increase
- ability to withdraw indivually or other...


See list of your planets
------------------------

- browse list
- select to go to planet on the map, selected


See list of your fleets
-----------------------

- browse list
- select to go to fleet destination/origin


See list of global events
-------------------------

- see all players actions and resolution
- filter per alliance


See list of notifications (personal events)
-------------------------

- see all your fleet resolved/failed
- see all your planet exited/failed
- see enemies attack
- see other player spaceship gifting



See list of players
-------------------

- browse list (ordered by amount stake / token available)
- select to message player


Contact Player
--------------

- Select planet
- send message to owner
- enter message
- ability to mention planet or even attack strategy
- confirm send


Read Messages
-------------

- get notification of messages to read
- select message
- read
- (reply) -> see "Contact Player"



See list of public alliances
----------------------------

- browse list
- select to join


Join Public Alliances
---------------------

- Select a player. select alliance
- redirect to webpage to join
- ...


Leave Alliances
---------------

- alliance web page



Sell Spaceships
---------------

- select planet
- (approve sell contract)
- put spaceship for sale => message


Push Notifications
------------------

- receive notification on personal event + specific filter



# NOTES


- Show visually the difference between planet where a pkayer has some spaceship on it but is not staking there (this could be because the player send spaceship there to get some outward protection, or because some other player exited the planet while he was sending an attack)

- change rules for exiting ? should the natives get back to the planet. If not there is danger ine xiting for planets around since a new player staking on it will have no loss and start at 100,000.
    An other idea, would be to remove native and normalise the number of starting spaceship. And for sending spaceship to virgin planet, we could either let them send without loss or keep a minimum loss ?


- show stake of players, withdrawal balance and token in wallet ?
- show exit success


