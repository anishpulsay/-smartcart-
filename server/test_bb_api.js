const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
   try {
       const res = await fetch('https://www.bigbasket.com/product/get-products/?slug=fresh-vegetables&page=1', {
           headers: { 'User-Agent': 'Mozilla/5.0' }
       });
       if(res.ok) {
           const data = await res.json();
           console.log(JSON.stringify(data).substring(0, 500));
       } else {
           console.log('Failed:', res.status);
       }
   } catch(e) { console.log(e.message); }
})();
