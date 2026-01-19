// worker/domain-validator.js
export class DomainValidator {
  constructor() {
    this.allowedDomains = {
      "zd8k2m7n9p": ["https://www.devonshiredental.net"],
      "q1w3e5t7y9": ["http://www.convivialdental.com"],
      "a2s4d6f8g0": ["https://bubbledentistry.com"],
      "h5j7k9l1m3": ["https://www.myatlantisdental.com"],
      "p0o9i8u7y6": ["https://bostondental.com"],
      "t5r4e3w2q1": ["https://www.southbostondental.com"],
      "z9x8c7v6b5": ["https://acedentalboston.com"],
      "n4m3b2v1c0": ["https://www.citidentalboston.com"],
      "l8k9j0h1g2": ["https://smilestudioboston.com"],
      "f3d4s5a6q7": ["http://www.seaportdental.com"],
      "r9t0y1u2i3": ["https://www.mybackbaydentist.com"],
      "o4p5i6u7y8": ["https://bcoh.com"],
      "w2e3r4t5y6": ["https://britofamilydental.com"],
      "b7n8m9k0j1": ["https://www.prudential-dental.com"],
      "x1c2v3b4n5": ["https://sweetspotdental.com"],
      "m6n7b8v9c0": ["https://elitedentalofnatick.com"],
      "k3j4h5g6f7": ["https://alphaplusdentalcenter.com"],
      "d8f9g0h1j2": ["http://arlingtonsmilesma.com"],
      "s5a6q7w8e9": ["https://www.hsdm.harvard.edu/patients"],
      "y0t1r2e3w4": ["https://www.middletondentalcare.com"],
      "u5i6o7p8a9": ["https://www.myrismile.com"],
      "c4x5z6l7p8": ["http://www.dentalsolutionsdmd.com"],
      "g2h3j4k5l6": ["https://smilesri.com"],
      "q8w9e0r1t2": ["http://www.accessdentalri.com"],
      "y3u4i5o6p7": ["http://www.islanddentalhealth.com"],
      "a9s0d1f2g3": ["https://www.advanceddentalcare.com"],
      "h4j5k6l7z8": ["http://westshoredentistry.com"],
      "x0c9v8b7n6": ["https://www.smileri.com"],
      "m5k4j3h2g1": ["http://www.friendsandfamilydentalri.com"],
      "v9b0n1m2k3": ["https://ricomfortdental.com"]
    };
  }

  validate(clinicId, origin) {
    if (!clinicId || !origin) {
      return { valid: false, reason: "Missing clinic ID or origin" };
    }

    const allowed = this.allowedDomains[clinicId];
    
    if (!allowed) {
      return { valid: false, reason: "Clinic not found" };
    }

    // Extract hostname from origin
    let originHostname;
    try {
      const originUrl = new URL(origin);
      originHostname = originUrl.hostname;
    } catch (e) {
      return { valid: false, reason: "Invalid origin URL" };
    }

    // Check if origin matches any allowed domain
    const isAllowed = allowed.some(domain => {
      try {
        const domainUrl = new URL(domain);
        return domainUrl.hostname === originHostname;
      } catch (e) {
        return false;
      }
    });

    if (!isAllowed) {
      return { 
        valid: false, 
        reason: `Domain ${originHostname} not authorized for this clinic`,
        allowedDomains: allowed
      };
    }

    return { valid: true };
  }

  // For development/testing - allow localhost
  validateWithDev(clinicId, origin) {
    const result = this.validate(clinicId, origin);
    
    // Allow localhost for development
    if (!result.valid && origin.includes('localhost')) {
      return { valid: true, isLocalhost: true };
    }
    
    return result;
  }
}