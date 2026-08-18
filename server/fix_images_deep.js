import { getDb } from './db.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

async function fetchFallback(query) {
    try {
        const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }});
        const match = (await res.text()).match(/murl&quot;:&quot;(.*?)&quot;/);
        return match ? match[1] : null;
    } catch { return null; }
}

(async () => {
    console.log('Starting DEEP image repair...');
    const db = await getDb();
    let updated = 0;
    
    for (let p of db.data.products) {
        let isBroken = false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(p.imageUrl, { method: 'GET', signal: controller.signal, headers: { 'Accept': 'image/avif,*/*', 'Referer': 'http://localhost:5173/' } });
            clearTimeout(timeoutId);
            if (res.status >= 400 && res.status !== 405) { isBroken = true; }
        } catch (e) {
            isBroken = true;
        }

        if (isBroken) {
            console.log(`[BROKEN] repairing ${p.name}...`);
            let url = await fetchFallback(p.name + ' site:amazon.in');
            if (!url) { await new Promise(r => setTimeout(r, 400)); url = await fetchFallback(p.name + ' product package india white background'); }
            
            if (url) {
                p.imageUrl = url;
                console.log(` -> Fixed`);
                updated++;
            } else {
                p.imageUrl = `https://loremflickr.com/400/400/${encodeURIComponent(p.category.split(' ')[0])}?lock=${Math.floor(Math.random()*100)}`;
                console.log(` -> Used placeholder.`);
                updated++; // updated either way to prevent broken image
            }
        }
    }
    
    if (updated > 0) {
        await db.write();
        console.log(`✅ Repair complete. Fixed ${updated} images!`);
    } else {
        console.log('✅ All images are pristine!');
    }
    process.exit(0);
})();
