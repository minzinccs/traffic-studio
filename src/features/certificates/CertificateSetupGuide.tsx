import type {CertificateTarget} from './setup';

const content:Record<CertificateTarget,{title:string;steps:string[];limit:string}>={
 overview:{title:'Choose a certificate setup target',steps:['Create a local signing CA below, then select it when starting native capture.','Export only the public CA certificate to clients that need to trust intercepted HTTPS.'],limit:'The LAN metadata server in Devices has a separate temporary TLS certificate and fingerprint.'},
 'local-machine':{title:'Local Machine trust',steps:['Create a local CA below and compare its SHA-256 fingerprint before changing trust.','This app can install or remove that CA for the current Windows user using the explicit controls below.'],limit:'Computer-wide Local Machine trust is not implemented. The current-user button does not change the machine-wide store.'},
 android:{title:'Android certificate setup',steps:['Export the public CA PEM below and transfer it to your own device through a trusted channel.','On the device, import it into the user certificate store and verify its fingerprint. Configure the client app to trust user CAs where supported.'],limit:'The capture proxy still listens only on this PC’s localhost. Phone proxy setup and HTTPS capture are not connected yet; some apps reject user CAs or pin certificates.'},
 ios:{title:'iOS certificate setup',steps:['Export the public CA PEM below and transfer it to your own device through a trusted channel.','Install the certificate profile and explicitly enable trust on the device, checking the fingerprint first.'],limit:'The capture proxy still listens only on this PC’s localhost. Phone proxy setup and HTTPS capture are not connected yet; pinned apps may reject interception.'},
 firefox:{title:'Firefox certificate setup',steps:['Export the public CA PEM below.','Import it into Firefox’s certificate authorities for the browser profile you intend to use, then verify the fingerprint.'],limit:'This app cannot inspect, install or remove certificates in Firefox profiles. Remove the CA there when it is no longer needed.'},
 java:{title:'Java VM certificate setup',steps:['Export the public CA PEM below.','Import it into the specific application truststore or JVM truststore you control, then verify its fingerprint.'],limit:'This app cannot inspect, install or remove Java truststore entries. Avoid modifying a shared system JVM without checking which apps use it.'},
 view:{title:'View Root Certificate',steps:['The certificate list below shows SHA-256 fingerprints and public PEM.','Private CA keys are not exported.'],limit:'A CA shown here is not automatically trusted by Windows or any other device.'},
 manage:{title:'Root Certificate Management',steps:['Create a local CA and export its public PEM using the controls below.','With explicit confirmation, install or remove an app-owned CA in the current Windows user Root store.'],limit:'Machine-wide, browser, mobile and Java trust stores remain manual.'},
 ssl:{title:'SSL interception certificate',steps:['Select the signing CA in Native capture and enable TLS decryption.','The capture engine generates site certificates from the selected CA while handling intercepted connections.'],limit:'Clients must trust that CA. The current capture proxy is bound to localhost; this does not enable phone capture.'},
};

export function CertificateSetupGuide({target}:{target:CertificateTarget}){
 const item=content[target];
 return <section className="certificate-guide" aria-label={item.title}>
  <h4>{item.title}</h4><ol>{item.steps.map(step=><li key={step}>{step}</li>)}</ol><p role="note">{item.limit}</p>
 </section>;
}
