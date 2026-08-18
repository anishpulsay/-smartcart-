import { getDb } from './db.js';
import { blinkitProducts } from './blinkit_data.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

async function fetchImage(query) {
    try {
        const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA } });
        const match = (await res.text()).match(/murl&quot;:&quot;(.*?)&quot;/);
        return match ? match[1] : null;
    } catch { return null; }
}

(async () => {
    console.log(`Starting to scrape genuine images for ${blinkitProducts.length} authentic Blinkit items...`);
    const db = await getDb();
    const oldProducts = new Map(db.data.products.map(p => [p.name, p.imageUrl]));
    
    let barcodeCounter = 8901000000000;
    const finalProducts = [];
    
    for (let p of blinkitProducts) {
        let url = oldProducts.get(p.name);
        
        if (!url || url.includes('loremflickr')) {
            url = await fetchImage(p.name + ' site:bigbasket.com');
            if (!url) { await new Promise(r => setTimeout(r, 400)); url = await fetchImage(p.name + ' site:blinkit.com'); }
            if (!url) { await new Promise(r => setTimeout(r, 400)); url = await fetchImage(p.name + ' amazon india white background'); }
            await new Promise(r => setTimeout(r, 400));
        }
        
        finalProducts.push({
            barcode: String(barcodeCounter++),
            name: p.name,
            price: p.price,
            weight: p.weight,
            category: p.category,
            imageUrl: url || `https://loremflickr.com/400/400/${encodeURIComponent(p.category.split(' ')[0])}?lock=${Math.floor(Math.random()*100)}`
        });
        console.log(`[${finalProducts.length}/${blinkitProducts.length}] ${p.name} -> ${url ? 'Found' : 'Placeholder'}`);
    }
    
    db.data.products = finalProducts;
    await db.write();
    console.log(`✅ Seeded ${finalProducts.length} highly authentic products!`);
    process.exit(0);
})();
