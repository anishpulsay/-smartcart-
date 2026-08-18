import { getDb } from './db.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

async function fetchImage(query) {
    try {
        const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': UA }
        });
        const html = await res.text();
        const match = html.match(/murl&quot;:&quot;(.*?)&quot;/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

(async () => {
    console.log("Scanning database for missing images...");
    const db = await getDb();
    let updated = 0;
    
    for (let p of db.data.products) {
        if (!p.imageUrl || p.imageUrl.includes('loremflickr')) {
            console.log(`Fixing image for: ${p.name}`);
            
            let url = await fetchImage(p.name + ' site:jiomart.com');
            
            if (!url) {
                await new Promise(r => setTimeout(r, 400));
                url = await fetchImage(p.name + ' site:amazon.in');
            }
            
            if (!url) {
                await new Promise(r => setTimeout(r, 400));
                url = await fetchImage(p.name + ' product package india white background');
            }
            
            if (url) {
                p.imageUrl = url;
                console.log(` -> Found: ${url}`);
            } else {
                console.log(` -> STILL MISSING!`);
            }
            updated++;
            await new Promise(r => setTimeout(r, 600));
        }
    }
    
    if (updated > 0) {
        await db.write();
        console.log(`Fixed images for ${updated} products!`);
    } else {
        console.log(`All images are already present. No missing images found.`);
    }
    process.exit(0);
})();
