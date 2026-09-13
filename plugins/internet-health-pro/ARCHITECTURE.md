# Monitoring architecture

Internet Health Pro owns exactly one `NetworkMonitor` per plugin process.

## Cadence

- primary ICMP latency probe: default every 10 seconds
- independent DNS/TCP diagnostic set: every 30 seconds, or immediately after primary failure
- small HTTPS response-timing diagnostic: every 60 seconds
- distinct user Target Health probes: default every 30 seconds, maximum 8 distinct target configurations
- throughput: manual only, maximum about 8 MB down + 2 MB up per run

All visible keys subscribe to the same snapshot. A second Latency or Health key does not start another poller.

## Outage classification

A primary ICMP miss is never enough to call the internet offline.

On failure, the engine cross-checks independent signals including a second ICMP target, TCP-connect reachability to two public IPs, and DNS resolution against two hostnames. A full outage requires two consecutive diagnostic cycles with no IP reachability. DNS failure is separate and also requires repeated evidence.

If ICMP has never worked on the current run but TCP does, the connection remains online and the latency method is labeled TCP CONNECT. ICMP failures are only included in the loss percentage after ICMP has first been proven to work.

## History

History is a bounded local JSON file with atomic writes. Raw monitoring samples retain at most 24 hours, outages retain a bounded recent list, and speed results retain the most recent 20 runs. Sleep/resume gaps are written as unobserved gaps instead of outages.

## Failure behavior

Confirmed offline state uses exponential polling backoff up to 60 seconds. Monitoring pauses while the user-triggered speed test is running and resumes immediately afterward.
