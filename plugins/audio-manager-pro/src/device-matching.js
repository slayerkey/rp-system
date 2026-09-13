export function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function endpointIdentity(endpoint) {
  const source = endpoint && typeof endpoint === "object" ? endpoint : {};
  return {
    endpointId: String(source.id || source.endpointId || ""),
    name: String(source.name || ""),
    instanceId: String(source.instanceId || ""),
    containerId: String(source.containerId || "").toLocaleLowerCase(),
  };
}

function uniqueMatch(endpoints, predicate) {
  const matches = endpoints.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

export function matchEndpoint(identity, endpoints = []) {
  const wanted = endpointIdentity(identity);
  const list = Array.isArray(endpoints) ? endpoints : [];

  if (!wanted.endpointId && !wanted.name && !wanted.instanceId && !wanted.containerId) {
    return { status: "missing", endpoint: null, strategy: "none", reason: "No saved device identity." };
  }

  const exact = list.find((endpoint) => String(endpoint.id || "") === wanted.endpointId);
  if (exact) return { status: "matched", endpoint: exact, strategy: "endpoint-id", reason: "" };

  if (wanted.containerId && wanted.name) {
    const byContainerAndName = uniqueMatch(list, (endpoint) =>
      normalizeText(endpoint.containerId) === normalizeText(wanted.containerId) &&
      normalizeText(endpoint.name) === normalizeText(wanted.name));
    if (byContainerAndName) {
      return { status: "matched", endpoint: byContainerAndName, strategy: "container+name", reason: "" };
    }
  }

  const nameMatches = list.filter((endpoint) => normalizeText(endpoint.name) === normalizeText(wanted.name));
  if (nameMatches.length === 1) {
    return {
      status: "rebind-required",
      endpoint: nameMatches[0],
      strategy: "friendly-name-only",
      reason: "A device with the same friendly name exists, but hardware identity changed. Rebind it explicitly.",
    };
  }

  if (nameMatches.length > 1) {
    return {
      status: "ambiguous",
      endpoint: null,
      strategy: "friendly-name-ambiguous",
      reason: "Multiple active devices share this friendly name. Rebind the intended device.",
    };
  }

  return {
    status: "missing",
    endpoint: null,
    strategy: "not-found",
    reason: `Missing device: ${wanted.name || "saved audio endpoint"}`,
  };
}
