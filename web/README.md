- delete privateAccount.ts
- replace planetLogs.ts

- attackOrGiftsReceived.ts
  or have any events taken from spaceQuery
- globalLogs delayed -> uses spaceQuery's blockHash (to report)
- fleets state based on events (if using spaceQuery) or use a check to see tx was part of the query result (the result already included in the data)
