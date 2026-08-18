import { getDb } from './db.js';

(async () => {
    const db = await getDb();
    let broken = [];
    let count = 0;
    
    console.log('Testing image links with browser-like headers (CORS/Hotlinking)...');
    
    for (let p of db.data.products) {
        if (!p.imageUrl || !p.imageUrl.startsWith('http')) {
            console.log(`Invalid link for ${p.name}`);
            broken.push(p);
            continue;
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const res = await fetch(p.imageUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                   'Accept': 'image/avif,image/webp,*/*',
                   'Referer': 'http://localhost:5173/',
                }
            });
            clearTimeout(timeoutId);
            
            if (res.status >= 400 && res.status !== 405) {
               console.log(`❌ ${res.status} [${p.name}]`);
               broken.push(p);
            }
        } catch (e) {
            console.log(`❌ FetchError [${p.name}]: ${e.message}`);
            broken.push(p);
        }
        
        count++;
        if (count % 20 === 0) console.log(`Processed ${count}/${db.data.products.length}`);
    }
    console.log(`Total broken items: ${broken.length}`);
    process.exit(broken.length > 0 ? 1 : 0);
})();
