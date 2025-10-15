# Stackblaze Logs

The Stackblaze Logs plugin offers a queryless experience for browsing Loki logs without the need for writing complex queries. Discover or narrow down your search by using volume and text patterns. Uncover related logs and understand patterns—all with just a few clicks. No LogQL required. With Stackblaze Logs, you can:

- Easily find logs and log volumes for all of your services
- Effortlessly filter service logs based on their log volumes, labels, fields, or patterns.
- Automatically choose the best visualization for your log data based on its characteristics, without any manual setup.

...all without crafting a single query!

<img width="840" alt="Screenshot of Grafana Logs Drilldown" src="src/img/drilldown-features.png">

## Build and Package

To build and package the plugin:

```sh
make package
```

This will:
1. Build the plugin using webpack
2. Create a distributable zip file at `dist/stackblaze-logs-app.zip`

## Installation

> [!IMPORTANT]  
> The following Loki and Grafana version and configuration are required:
>
> - Loki v3.2+
>   - Volume endpoint enabled in Loki config:
>     - `--pattern-ingester.enabled=true` for pattern ingestion
>   - Level detection enabled in Loki config:
>     - `--validation.discover-log-levels=true` for level detection

> ```yaml
> limits_config:
>   volume_enabled: true
>   discover_log_levels: true
> ```
>
> - Grafana v11.6+

## Configuration

The datasource is now configured via URL parameters instead of dropdown selection. When accessing the plugin, pass the datasource UID as a parameter:

```
/a/stackblaze-logs-app/explore?var-ds=<datasource-uid>
```

For example:
```
/a/stackblaze-logs-app/explore?var-ds=loki-cluster-68
```

## Getting Started

1. Navigate to the plugin by accessing the URL with the datasource parameter: `/a/stackblaze-logs-app/explore?var-ds=<your-loki-datasource-uid>`
2. You'll land in the service overview page that shows time series and log visualizations for all the services in your selected Loki instance.
3. Modify your time range in two ways:
   - With the standard time range picker on the top right.
   - By clicking and dragging the time range you want to see on any time series visualization.
5. Services are shown based on the volume of logs, and you can search for the service you want through the Search service input.
6. Select the service you would like to explore. This takes you to the Service page.
7. Filter logs based on strings, labels, fields, or detected patterns.

<img src="src/img/service_logs.jpg" alt="app"/>

## Support

For questions and support, please contact the Stackblaze team.

## Development

In order to run the setup locally and build the plugin by your own, follow these steps:

1. `yarn install`
2. `yarn dev` this builds the plugin continuously
3. `yarn server` this spins up the docker setup, including a Loki instance and the fake data generator

## Supported Features

This section outlines the supported features available by page: Service Selection and Service Detail.

### Service Selection

Service Selection is the entry step where users can choose a service. List of features and functionalities:

**1. Fetching of services** - Services are fetched using the Loki [/loki/api/v1/index/volume](https://grafana.com/docs/loki/latest/reference/loki-http-api/#query-log-volume) endpoint and ordered by their volume. Services are re-fetched when the time range significantly changes to ensure correct data. Services are updated if:

- The time range scope changes (hours vs. days).
- The new time range is under 6 hours and the difference exceeds 30 minutes.
- The new time range is under 1 day and the difference exceeds 1 hour.
- The new time range is over 1 day and the difference exceeds 1 day.

**2. Showing of services** - Services are shown based on volume and are lazy-loaded. Metrics and logs are queried only for services that are scrolled to.

**3. Previously selected services** - Previously selected services are displayed at the top of the list for easier access.
* Services can also be manually "favorited" by clicking the star on the service. Previously selected services are not shared between users.

**4. Searching of services** - The search input can be used to filter services that include the specified string.
