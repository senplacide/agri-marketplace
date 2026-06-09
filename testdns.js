const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

console.log('Using DNS:', dns.getServers());

dns.resolveSrv(
  '_mongodb._tcp.cluster30.cmyolwl.mongodb.net',
  (err, records) => {
    if (err) {
      console.error(err);
    } else {
      console.log(records);
    }
  }
);