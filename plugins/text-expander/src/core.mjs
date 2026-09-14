const SIMPLE_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const COUNTER = /^counter:([A-Za-z][A-Za-z0-9_-]{0,63})$/;
const DATE_TOKEN = /^(date|time|datetime)(?::(.+))?$/;
const RESERVED_VARIABLES = new Set(["date","time","datetime","clipboard","username","computer","app","cursor"]);

export const LITE_LIMIT = 10;
export const PRO_LIMIT = 5000;

export const LITE_SEEDS = [
  { id:"lite-email", name:"Email", folder:"STARTER", content:"REPLACE WITH YOUR EMAIL" },
  { id:"lite-clipboard", name:"Clipboard", folder:"STARTER", content:"{clipboard}" }
];

export const PRO_SEEDS = [
  { id:"pro-quick-email", name:"Email", folder:"QUICK", content:"REPLACE WITH YOUR EMAIL" },
  { id:"pro-quick-clipboard", name:"Clipboard", folder:"QUICK", content:"{clipboard}" },
  { id:"pro-quick-time", name:"Time", folder:"QUICK", content:"{time}" },
  { id:"pro-quick-date", name:"Date", folder:"QUICK", content:"{date}" },
  { id:"pro-quick-address", name:"Address", folder:"QUICK", content:"REPLACE WITH YOUR ADDRESS" },
  { id:"pro-quick-link", name:"Link", folder:"QUICK", content:"REPLACE WITH YOUR LINK" },
  { id:"pro-email-reply", name:"Email Reply", folder:"EMAIL", content:"Hi {name},\n\nThanks for reaching out about {topic}.\n\n{reply}\n\n{signature}" },
  { id:"pro-follow-up", name:"Follow-Up", folder:"EMAIL", content:"Hi {name},\n\nJust following up on {topic}.\n\n{signature}" },
  { id:"pro-meeting-link", name:"Meeting Link", folder:"EMAIL", content:"Here is the meeting link: {meeting_link}" },
  { id:"pro-support-response", name:"Support Response", folder:"SUPPORT", content:"Hi {name},\n\nThanks for reaching out about {topic}.\n\n{response}\n\n{signature}" },
  { id:"pro-bug-request", name:"Bug Details Request", folder:"SUPPORT", content:"Could you send the app version, exact steps to reproduce, and any error message you see?\n\nReference: {counter:support}" },
  { id:"pro-youtube", name:"YouTube Description Block", folder:"CREATOR", content:"{title}\n\n{description}\n\nLinks:\n{links}" },
  { id:"pro-discord", name:"Discord Announcement", folder:"CREATOR", content:"📣 {headline}\n\n{message}\n\n{cta}" },
  { id:"pro-code", name:"Code Snippet", folder:"DEVELOPMENT", content:"// {purpose}\n{code}\n{cursor}" },
  { id:"pro-timestamp", name:"Timestamp", folder:"DEVELOPMENT", content:"{datetime:YYYY-MM-DD HH:mm:ss}" },
  { id:"pro-personal-meeting", name:"Meeting URL", folder:"PERSONAL", content:"{meeting_link}" },
  { id:"pro-address", name:"Address / Contact", folder:"PERSONAL", content:"REPLACE WITH YOUR ADDRESS OR CONTACT BLOCK" }
];

export const DEFAULT_PRO_VARIABLES = {
  signature: "REPLACE ME",
  meeting_link: "REPLACE WITH YOUR LINK"
};

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = MONTHS.map(v => v.slice(0,3));
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = DAYS.map(v => v.slice(0,3));

export function formatDate(date, pattern) {
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const values = {
    YYYY: String(date.getFullYear()),
    YY: pad(date.getFullYear() % 100),
    MMMM: MONTHS[date.getMonth()],
    MMM: MONTHS_SHORT[date.getMonth()],
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    dddd: DAYS[date.getDay()],
    ddd: DAYS_SHORT[date.getDay()],
    HH: pad(h24),
    H: String(h24),
    hh: pad(h12),
    h: String(h12),
    mm: pad(date.getMinutes()),
    m: String(date.getMinutes()),
    ss: pad(date.getSeconds()),
    s: String(date.getSeconds()),
    A: h24 < 12 ? "AM" : "PM",
    a: h24 < 12 ? "am" : "pm"
  };
  return String(pattern).replace(/YYYY|MMMM|dddd|MMM|ddd|YY|MM|DD|HH|hh|mm|ss|M|D|H|h|m|s|A|a/g, token => values[token]);
}

export function dateValue(kind, date, customFormat = "") {
  const fallback = kind === "date" ? "YYYY-MM-DD" : kind === "time" ? "HH:mm" : "YYYY-MM-DD HH:mm";
  return formatDate(date, customFormat || fallback);
}

function protectEscapedBraces(text) {
  return String(text)
    .replace(/{{/g, "\uE000")
    .replace(/}}/g, "\uE001");
}
function restoreEscapedBraces(text) {
  return String(text).replace(/\uE000/g, "{").replace(/\uE001/g, "}");
}

export function tokenNames(content) {
  const protectedText = protectEscapedBraces(content);
  return [...protectedText.matchAll(/{([^{}]+)}/g)].map(match => match[1]);
}

export function counterNames(content) {
  return [...new Set(tokenNames(content)
    .map(token => token.match(COUNTER)?.[1])
    .filter(Boolean))];
}

export function analyzeTemplateFields(content, { edition = "lite", variables = {} } = {}) {
  if (edition !== "pro") return [];
  const reserved = new Set(["date","time","datetime","clipboard","username","computer","app","cursor"]);
  const result = [];
  for (const token of tokenNames(content)) {
    if (reserved.has(token)) continue;
    if (DATE_TOKEN.test(token)) continue;
    if (COUNTER.test(token)) continue;
    if (Object.prototype.hasOwnProperty.call(variables, token)) continue;
    if (SIMPLE_NAME.test(token) && !result.includes(token)) result.push(token);
  }
  return result;
}

export function validateVariableName(name) {
  const value = String(name || "");
  return SIMPLE_NAME.test(value) && !RESERVED_VARIABLES.has(value);
}

function graphemeCount(value) {
  const text = String(value);
  if (typeof Intl?.Segmenter === "function") {
    return [...new Intl.Segmenter(undefined, { granularity:"grapheme" }).segment(text)].length;
  }
  return Array.from(text).length;
}

export function renderSnippet(content, {
  edition = "lite",
  now = new Date(),
  clipboard = "",
  username = "",
  computer = "",
  app = "",
  variables = {},
  fields = {},
  counters = {}
} = {}) {
  let text = protectEscapedBraces(content);
  let cursorSentinel = "\uE002";
  let cursorSeen = false;

  text = text.replace(/{([^{}]+)}/g, (whole, rawToken) => {
    const token = String(rawToken);
    if (token === "date") return dateValue("date", now);
    if (token === "time") return dateValue("time", now);
    if (token === "clipboard") return String(clipboard ?? "");

    if (edition !== "pro") return whole;

    if (token === "datetime") return dateValue("datetime", now);
    if (token === "username") return String(username ?? "");
    if (token === "computer") return String(computer ?? "");
    if (token === "app") return String(app ?? "");
    if (token === "cursor") {
      if (cursorSeen) return "";
      cursorSeen = true;
      return cursorSentinel;
    }

    const dateMatch = token.match(DATE_TOKEN);
    if (dateMatch) return dateValue(dateMatch[1], now, dateMatch[2] || "");

    const counterMatch = token.match(COUNTER);
    if (counterMatch) return String(counters[counterMatch[1]] ?? "");

    if (Object.prototype.hasOwnProperty.call(variables, token)) return String(variables[token] ?? "");
    if (Object.prototype.hasOwnProperty.call(fields, token)) return String(fields[token] ?? "");
    return whole;
  });

  const markerIndex = text.indexOf(cursorSentinel);
  let cursorBack = 0;
  if (markerIndex >= 0) {
    const after = text.slice(markerIndex + cursorSentinel.length).replaceAll(cursorSentinel, "");
    cursorBack = graphemeCount(restoreEscapedBraces(after));
    text = text.replaceAll(cursorSentinel, "");
  }

  return { text: restoreEscapedBraces(text), cursorBack };
}

export function resolveSnippetSelection(snippets, settings = {}) {
  const items = Array.isArray(snippets) ? snippets : [];
  const requested = String(settings?.snippetId || "");
  const snippet = items.find(item => item?.id === requested) || items[0] || null;
  if (!snippet || snippet.id === requested) return { snippet, settings, changed:false };
  return {
    snippet,
    settings:{ ...settings, snippetId:snippet.id },
    changed:true
  };
}

export function chooseInsertionMode(requestedMode, text) {
  if (requestedMode === "unicode" || requestedMode === "clipboard") return requestedMode;
  const value = String(text);
  // Smart mode should preserve authored text, not reinterpret line breaks/tabs
  // as navigation or submit keys in chat/browser fields. Clipboard paste is the
  // safer default for structured text and for large payloads.
  return value.length > 2048 || /[\r\n\t]/.test(value) ? "clipboard" : "unicode";
}
