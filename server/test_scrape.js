async function getImageUrl(query) {
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query + ' site:bigbasket.com')}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const match = html.match(/murl&quot;:&quot;(.*?)&quot;/);
    if (match) return match[1];
    return null;
  } catch (e) {
    return null;
  }
}

(async () => {
    console.log(await getImageUrl('Tata Salt 1kg'));
    console.log(await getImageUrl('Amul Butter 100g'));
    console.log(await getImageUrl('Lays Classic Chips 50g'));
    console.log(await getImageUrl('Surf Excel Detergent 1kg'));
})();
