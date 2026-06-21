(()=>{var a={};a.id=821,a.ids=[821],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4266:(a,b,c)=>{"use strict";c.d(b,{l:()=>i});var d=c(29021),e=c(33873),f=c(55511),g=c(74347),h=c(78985);async function i({cardId:a,customerName:b,stamps:c,authToken:i,baseUrl:j}){let k=new g,l=process.env.APPLE_PASS_TYPE_ID||"pass.com.crepes.loyalty",m=process.env.APPLE_TEAM_ID||"GAKTEAM123",n=`${j}/api/passes`,o=`${j}/loyalty?id=${a}`,p={formatVersion:1,passTypeIdentifier:l,serialNumber:a,teamIdentifier:m,webServiceURL:n,authenticationToken:i,barcode:{message:o,format:"PKBarcodeFormatQR",messageEncoding:"iso-8859-1",altText:""},organizationName:"Cr\xeapes GAK",description:"Cr\xeapes GAK Treuekarte",logoText:"Cr\xeapes GAK",foregroundColor:"rgb(255, 255, 255)",backgroundColor:"rgb(42, 24, 16)",labelColor:"rgb(218, 165, 32)",storeCard:{primaryFields:[{key:"stamps",label:10===c?"Gratis Cr\xeape!":`${c} von 10 Stempel`,value:10===c?"\uD83C\uDF81\uD83C\uDF81\uD83C\uDF81\uD83C\uDF81\uD83C\uDF81":c>0?"\uD83E\uDD5E".repeat(c):"Bereit zum Sammeln"}],secondaryFields:[{key:"customerName",label:"",value:b}],backFields:[{key:"terms",label:"Nutzungsbedingungen",value:"F\xfcr jeden gekauften Cr\xeape am Cr\xeapes-GAK-Stand gibt es einen Stempel. Bei 10 Stempeln erh\xe4ltst du deinen 10. (oder n\xe4chsten) Cr\xeape gratis. Nach dem Einl\xf6sen wird die Karte automatisch wieder auf 0 gesetzt."},{key:"contact",label:"Bestellungen & Info",value:`Deine Treuekarten-ID: ${a}
Besuche uns online unter ${j} f\xfcr Bestellungen und Standorte.`}]}},q=Buffer.from(JSON.stringify(p,null,2),"utf8");k.file("pass.json",q);let r=e.join(process.cwd(),"public","pass"),s={"pass.json":q};for(let a of["icon.png","logo.png","strip.png"]){let b=e.join(r,a);if(d.existsSync(b)){let c=d.readFileSync(b);k.file(a,c),s[a]=c;let f=a.replace(".png","@2x.png"),g=e.join(r,f);if(d.existsSync(g)){let a=d.readFileSync(g);k.file(f,a),s[f]=a}}}let t={};for(let[a,b]of Object.entries(s))t[a]=f.createHash("sha1").update(b).digest("hex");let u=Buffer.from(JSON.stringify(t,null,2),"utf8");k.file("manifest.json",u);let v=process.env.APPLE_PASS_CERTIFICATE,w=process.env.APPLE_PASS_PRIVATE_KEY,x=process.env.APPLE_PASS_WWDR_CERTIFICATE;if(!v||!w||!x){let a=[];throw v||a.push("APPLE_PASS_CERTIFICATE"),w||a.push("APPLE_PASS_PRIVATE_KEY"),x||a.push("APPLE_PASS_WWDR_CERTIFICATE"),Error(`Zertifikate fehlen: [${a.join(", ")}]. Ohne diese Zertifikate verweigert iOS das Hinzuf\xfcgen der Karte zur Apple Wallet App.`)}try{let a=function(a,b,c,d){try{let e=h.pkcs7.createSignedData();e.content=h.util.createBuffer(a,"utf8");let f=h.pki.certificateFromPem(b),g=h.pki.privateKeyFromPem(c),i=h.pki.certificateFromPem(d);e.addCertificate(f),e.addCertificate(i),e.addSigner({key:g,certificate:f,digestAlgorithm:h.pki.oids.sha1,authenticatedAttributes:[{type:h.pki.oids.contentType,value:h.pki.oids.data},{type:h.pki.oids.messageDigest},{type:h.pki.oids.signingTime,value:new Date}]}),e.sign();let j=e.toAsn1(),k=h.asn1.toDer(j).getBytes();return Buffer.from(k,"binary")}catch(a){throw console.error("Fehler bei der Signierung des Manifests:",a),a}}(u,v,w,x);k.file("signature",a)}catch(a){throw Error(`Fehler bei der kryptografischen Signierung des Manifests: ${a.message}. Bitte \xfcberpr\xfcfe das Format deiner PEM-Zertifikate (Zertifikat-Header, Zeilenumbr\xfcche etc.).`)}return await k.generateAsync({type:"nodebuffer"})}},8086:a=>{"use strict";a.exports=require("module")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},19176:(a,b,c)=>{"use strict";c.d(b,{FH:()=>e});var d=c(34032);let e=d.dp;(0,d.Op)()},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},46770:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>H,patchFetch:()=>G,routeModule:()=>C,serverHooks:()=>F,workAsyncStorage:()=>D,workUnitAsyncStorage:()=>E});var d={};c.r(d),c.d(d,{GET:()=>A,POST:()=>B});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(37820),w=c(19176),x=c(4266);let y=new v.Tb("https://knowing-gazelle-93.convex.cloud");function z(a,b=""){return new Response(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Wallet Pass Fehler</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #23120b;
          color: #f7ebe1;
          text-align: center;
          padding: 2rem 1rem;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 90vh;
        }
        .card {
          background: #2f1d15;
          border: 1px solid rgba(218, 165, 32, 0.25);
          padding: 2.5rem 1.5rem;
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }
        .icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: inline-block;
          animation: pulse 2s infinite;
        }
        h1 {
          color: #daa520;
          font-size: 1.4rem;
          margin: 0 0 1rem;
          font-weight: 800;
        }
        p {
          color: #cbb4a6;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0 0 1.5rem;
        }
        .details {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.85rem;
          border-radius: 8px;
          font-size: 0.78rem;
          color: #ff6b6b;
          text-align: left;
          word-break: break-all;
          white-space: pre-wrap;
          border-left: 3px solid #ff4a4a;
          margin-bottom: 1.5rem;
        }
        .btn {
          display: inline-block;
          background: #daa520;
          color: #23120b;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 0.9rem;
          box-shadow: 0 4px 10px rgba(218, 165, 32, 0.2);
          transition: all 0.2s ease;
        }
        .btn:active {
          transform: scale(0.98);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">⚠️</div>
        <h1>Pass-Erstellung fehlgeschlagen</h1>
        <p>${a}</p>
        ${b?`<div class="details">${b}</div>`:""}
        <a href="/loyalty" class="btn">Zur\xfcck zur Treuekarte</a>
      </div>
    </body>
    </html>
  `,{headers:{"Content-Type":"text/html; charset=utf-8"},status:200})}async function A(a){let{searchParams:b}=new URL(a.url),c=b.get("id"),d=a.headers.get("host")||"localhost:3000",e=a.headers.get("x-forwarded-proto")||"http",f=`${e}://${d}`;if(!c)return z("Fehlende Karten-ID in der URL.","Stelle bitte sicher, dass du die Treuekarte direkt \xfcber das Kunden-Dashboard ge\xf6ffnet hast.");try{let a=await y.query(w.FH.loyalty.getCard,{cardId:c});if(!a)return z("Die Treuekarte konnte im System nicht gefunden werden.",`Karten-ID: ${c}`);let b=await (0,x.l)({cardId:a._id,customerName:a.customerName,stamps:a.stamps,authToken:a.authToken,baseUrl:f});return new Response(b,{status:200,headers:{"Content-Type":"application/vnd.apple.pkpass","Content-Disposition":'attachment; filename="treuekarte.pkpass"',"Cache-Control":"no-store, no-cache, must-revalidate",Pragma:"no-cache",Expires:"0"}})}catch(a){return console.error("Fehler bei Pass-Generierung:",a),z("Bei der Erstellung deines Apple Wallet Passes ist ein Fehler aufgetreten. Die Zertifikate auf dem Server sind wahrscheinlich nicht korrekt hinterlegt.",a.message)}}async function B(a){try{let{customerName:b,authToken:c}=await a.json();if(!b||!c)return u.NextResponse.json({error:"Parameter customerName und authToken erforderlich"},{status:400});let d=await y.mutation(w.FH.loyalty.createCard,{customerName:b,authToken:c});return u.NextResponse.json({cardId:d})}catch(a){return console.error("Fehler beim Erstellen der Treuekarte:",a),u.NextResponse.json({error:"Interner Serverfehler"},{status:500})}}let C=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/passes/generate/route",pathname:"/api/passes/generate",filename:"route",bundlePath:"app/api/passes/generate/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/jakobfuhr/PROJEKTE/CODING/crepes-gak/app/api/passes/generate/route.js",nextConfigOutput:"",userland:d}),{workAsyncStorage:D,workUnitAsyncStorage:E,serverHooks:F}=C;function G(){return(0,g.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:E})}async function H(a,b,c){var d;let e="/api/passes/generate/route";"/index"===e&&(e="/");let g=await C.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||C.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===C.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>C.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>C.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await C.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await C.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await C.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},55511:a=>{"use strict";a.exports=require("crypto")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},78335:()=>{},79428:a=>{"use strict";a.exports=require("buffer")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[331,692,461,991],()=>b(b.s=46770));module.exports=c})();