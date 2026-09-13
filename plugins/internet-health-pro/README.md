# Internet Health Pro

Paid PackRat Stream Deck plugin for answering one question: **is my internet connection healthy over time?**

## Product job

This is not a Speedtest.net launcher. The shared plugin-process monitor watches connection health continuously with tiny probes and keeps bounded local history.

It distinguishes:

- Internet offline
- DNS failure
- Target offline
- High latency
- High jitter
- Observed probe loss

Measurement labels are literal. ICMP is called ICMP latency. TCP is called TCP-connect timing. HTTPS is called HTTPS response timing.

## Actions

Internet Health, Latency, Jitter / Loss, Outage, Target Health, Speed Test, Health Summary.

## Privacy

No PackRat telemetry. Health history is stored locally only. Speed tests are explicit/manual and capped at about 10 MB per run.
