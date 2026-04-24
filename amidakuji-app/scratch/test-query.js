import { FirestoreClient } from '../src/utils/firestore-rest';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.dev.vars' });
async function run() {
    const db = new FirestoreClient(process.env.FIREBASE_SERVICE_ACCOUNT);
    try {
        const query = {
            from: [{ collectionId: 'users' }]
        };
        const results = await db.runQuery('', query);
        console.log('Results:', JSON.stringify(results, null, 2).substring(0, 500));
    }
    catch (err) {
        console.error('Error:', err);
    }
}
run();
