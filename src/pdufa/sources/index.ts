// ────────────────────────────────────────────────────────────────────────────────
// sources/index.ts — registry
// ────────────────────────────────────────────────────────────────────────────────
import { fdaPress } from "./fdaPress";
import { fdaAdcomCalendar } from "./fdaAdcomCalendar";
import { federalRegister } from "./federalRegister";
import { cderWhatsNew } from "./cderWhatsNew";
import { dailymedRSS } from "./dailymed";
import { secEdgar } from "./secEdgar";
import { companyRSS } from "./companyRSS";
import { orangeBook, purpleBook } from "./orangePurple";
import { financialNews } from "./financialNews";
import { 
  emaRegulatory, 
  healthCanada, 
  pmdaJapan, 
  mhraUK, 
  tgaAustralia 
} from "./globalRegulatory";
import { 
  pharmaDepth, 
  biopharmIQ, 
  bioPharmaDive, 
  fiercePharma, 
  pharmaTimes, 
  endpointsNews 
} from "./industryPublications";
import { 
  yahooFinance, 
  reutersPharma, 
  marketWatch, 
  seekingAlpha, 
  zacksBiotech, 
  motleyFool 
} from "./financialData";
import { 
  clinicalTrialsGov, 
  euClinicalTrials, 
  whoTrials, 
  isrctn 
} from "./clinicalTrials";
import { 
  prNewswire, 
  businessWire, 
  globeNewswire, 
  accessWire, 
  investorRelations 
} from "./companyAnnouncements";
import { SourceDef } from "../types";

export const SOURCES: SourceDef[] = [
  // Core FDA Sources
  fdaPress,
  fdaAdcomCalendar,
  federalRegister,
  cderWhatsNew,
  dailymedRSS,
  secEdgar,
  companyRSS,
  orangeBook,
  purpleBook,
  
  // Financial News Sources
  financialNews,
  yahooFinance,
  reutersPharma,
  marketWatch,
  seekingAlpha,
  zacksBiotech,
  motleyFool,
  
  // Global Regulatory Agencies
  emaRegulatory,
  healthCanada,
  pmdaJapan,
  mhraUK,
  tgaAustralia,
  
  // Industry Publications
  pharmaDepth,
  biopharmIQ,
  bioPharmaDive,
  fiercePharma,
  pharmaTimes,
  endpointsNews,
  
  // Clinical Trial Databases
  clinicalTrialsGov,
  euClinicalTrials,
  whoTrials,
  isrctn,
  
  // Company Announcements
  prNewswire,
  businessWire,
  globeNewswire,
  accessWire,
  investorRelations,
];
