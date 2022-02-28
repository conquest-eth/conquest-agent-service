- [ ] error report tool
- [ ] implement the sign message with blockhash of last 255 block to perform a sneak attack/gifting before reveal time is open to everyone (allowing plausible deniability until that point : I reveal my secret to my so called "allies" so they know I am sending them gift, but just before reveal of gifting is allowed by anyone, I send a signed message making the attack, 10 minute before)
- [ ] sending fleet flow, show queueReveal progress and error
- [ ] when revealTIme come check agent-service for registered queueID and show broadcast status
- [ ] Optimistic agent-serve registration and topups (later we could use pendingAction system)
- [ ] SHow list of fleets on agent-service page and allow to register them each or all
- [ ] Better agent-screen
- [ ] Handle penind gagent topup tx
- [ ] Better withdrawal screen
- [ ] Uniswap screen ?
- [ ] Farming Screen ?
- [ ] Game Reward collection screen
- [ ] Alliance Screen
- [ ] Alliance website
- [ ] Documentation for smart contract
- [ ] Better event popups
- [ ] Better planet/event/fleet list : do not get under "pick origin"
- [ ] Better fleet to resolve fleet
- [ ] Better handling of clicks => planet click take precedence ? => show list of fleets ?
- [ ] fix Errors acknowledgements

- [ ] "once the tx is mined" message need to be reworded when time of arrival is specified
- [ ] fix zoom to see fleet, and remove click ?
- [ ] better event info, especially with cumulative attackes
- [ ] show event for fleet you sent and / or fleet other send for you
- [ ] PlanetElement: do not show red when no wallet connected
- [ ] FLeetElement: fix disapeating fleets when select circle is on ?
- [ ] drop down for allies ? when selecting owner
- [ ] drop down for fleet on same planet if reachable in time ?
- [ ] - ability to share fleets with friends ?
- [ ] RevealQueue : check if not submitting twice
- [ ] fix error acknowledgement not trigged syncrhonously
- [ ] show JSON rpc error message
- [ ] Clean log
- [ ] Memory leak ?
- [ ] plugin list
- [ ] Plugin marker on map + condition (like buttons), Marketplace sale => show whenver there is a sale (even if you are the owner), color ? blue ? radius ?

# ISSUES

- [ ] when not signed in, cannot acknowledge error or event: need to either force sign-in to see (same as fleets) orat least bring a popup to sign-in

# NOTES

- [ ] buying spaceships does not make you responsible for the attack, but you get to be the new owner in case of success, this could be implemented as transfer when planet is conquered
- [ ] transfer planet ownership should be possible
