async function getImageUrl(query) {
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(query + ' product')}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    // Bing stores the image URL in murl inside a JSON string
    const match = html.match(/murl&quot;:&quot;(.*?)&quot;/);
    if (match) {
        return match[1];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function test() {
    console.log(await getImageUrl('Surf Excel Matic Liquid'));
    console.log(await getImageUrl('Tata Salt 1kg'));
    console.log(await getImageUrl('Maggi Noodles'));
}
test();
