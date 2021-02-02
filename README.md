# NDNts-SVS

StateVectorSync library based on NDNts.

## Usage

Note: the library uses the nightly package of NDNts

```sh
npm install ndnts-svs
```

To create a new SVS socket

```typescript
import { Socket } from 'ndnts-svs';

const prefix = new Name('/ndn/svs');
const nodeId = 'alice';

const sock = new Socket(prefix, nodeId, fwFace, (missingData) => {
    // For each node with missing data
    for (const m of missingData) {
        // Fetch all new data
        for (let i = m.low; i <= m.high; i++) {
            sock.fetchData(m.session, i).then((data) => {
                const msg = new TextDecoder().decode(data.content);
                console.log(`${m.session} => ${msg}`);
            }).catch((err) => {
                console.warn(`Could not get data nid=${m.session} => ${i}`);
            });
        }
    }
});
```
