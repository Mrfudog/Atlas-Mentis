---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'

# Excalidraw Data

## Text Elements
Hetzner CPX22 · Ubuntu 24.04 · Docker ^rahmen-0-t

/srv/atlas/proxy ^rahmen-1-t

/srv/atlas/prod · Zweig main ^rahmen-2-t

/srv/atlas/dev · Zweig preprod ^rahmen-3-t

Browser
Spielleitung, Spielende ^user-t

caddy:2-alpine
TLS (Let's Encrypt)
Ports 80, 443 ^caddy-t

app · ghcr.io/…/atlas-mentis:main-‹sha›
Node 22 · Fastify + Angular-Build
127.0.0.1:8080 ^appP-t

db · postgres:17-alpine
./daten/db ^dbP-t

app · ghcr.io/…/atlas-mentis:preprod-‹sha›
127.0.0.1:8081 · noindex ^appD-t

db · postgres:17-alpine
./daten/db-preprod ^dbD-t

cron 03:17
pg_dump ^cron-t

atlas.‹domain›
dev.atlas.‹domain› ^pfeil-0-t

127.0.0.1:8080 ^pfeil-1-t

127.0.0.1:8081 ^pfeil-2-t

DATABASE_URL ^pfeil-3-t

DATABASE_URL ^pfeil-4-t

%%
## Drawing
```json
{
	"type": "excalidraw",
	"version": 2,
	"source": "https://github.com/zsviczian/obsidian-excalidraw-plugin",
	"elements": [
		{
			"id": "rahmen-0",
			"type": "rectangle",
			"x": 0,
			"y": 120,
			"width": 900,
			"height": 520,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 48271,
			"version": 1,
			"versionNonce": 182605794,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "rahmen-0-t",
			"type": "text",
			"x": 10,
			"y": 126,
			"width": 880,
			"height": 17.5,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1291394886,
			"version": 1,
			"versionNonce": 1914720637,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Hetzner CPX22 · Ubuntu 24.04 · Docker",
			"originalText": "Hetzner CPX22 · Ubuntu 24.04 · Docker",
			"rawText": "Hetzner CPX22 · Ubuntu 24.04 · Docker",
			"fontSize": 14,
			"fontFamily": 2,
			"textAlign": "left",
			"verticalAlign": "top",
			"containerId": null,
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 13
		},
		{
			"id": "rahmen-1",
			"type": "rectangle",
			"x": 330,
			"y": 160,
			"width": 240,
			"height": 110,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 2078669041,
			"version": 1,
			"versionNonce": 407355683,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "rahmen-1-t",
			"type": "text",
			"x": 340,
			"y": 166,
			"width": 220,
			"height": 17.5,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1105902161,
			"version": 1,
			"versionNonce": 854716505,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "/srv/atlas/proxy",
			"originalText": "/srv/atlas/proxy",
			"rawText": "/srv/atlas/proxy",
			"fontSize": 14,
			"fontFamily": 2,
			"textAlign": "left",
			"verticalAlign": "top",
			"containerId": null,
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 13
		},
		{
			"id": "rahmen-2",
			"type": "rectangle",
			"x": 20,
			"y": 310,
			"width": 370,
			"height": 300,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 564586691,
			"version": 1,
			"versionNonce": 1596680831,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "rahmen-2-t",
			"type": "text",
			"x": 30,
			"y": 316,
			"width": 350,
			"height": 17.5,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 192302371,
			"version": 1,
			"versionNonce": 1203428207,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "/srv/atlas/prod · Zweig main",
			"originalText": "/srv/atlas/prod · Zweig main",
			"rawText": "/srv/atlas/prod · Zweig main",
			"fontSize": 14,
			"fontFamily": 2,
			"textAlign": "left",
			"verticalAlign": "top",
			"containerId": null,
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 13
		},
		{
			"id": "rahmen-3",
			"type": "rectangle",
			"x": 510,
			"y": 310,
			"width": 370,
			"height": 300,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1250328747,
			"version": 1,
			"versionNonce": 1738531149,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "rahmen-3-t",
			"type": "text",
			"x": 520,
			"y": 316,
			"width": 350,
			"height": 17.5,
			"angle": 0,
			"strokeColor": "#868e96",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1271135913,
			"version": 1,
			"versionNonce": 1098894339,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "/srv/atlas/dev · Zweig preprod",
			"originalText": "/srv/atlas/dev · Zweig preprod",
			"rawText": "/srv/atlas/dev · Zweig preprod",
			"fontSize": 14,
			"fontFamily": 2,
			"textAlign": "left",
			"verticalAlign": "top",
			"containerId": null,
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 13
		},
		{
			"id": "user",
			"type": "ellipse",
			"x": 330,
			"y": 0,
			"width": 240,
			"height": 70,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "#ffffff",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 1882556969,
			"version": 1,
			"versionNonce": 2136927794,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "user-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-0"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "user-t",
			"type": "text",
			"x": 336,
			"y": 15,
			"width": 228,
			"height": 40,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1559527823,
			"version": 1,
			"versionNonce": 2075782095,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Browser\nSpielleitung, Spielende",
			"originalText": "Browser\nSpielleitung, Spielende",
			"rawText": "Browser\nSpielleitung, Spielende",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "user",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "caddy",
			"type": "rectangle",
			"x": 345,
			"y": 190,
			"width": 210,
			"height": 70,
			"angle": 0,
			"strokeColor": "#e67700",
			"backgroundColor": "#fff3bf",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 638022372,
			"version": 1,
			"versionNonce": 914937185,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "caddy-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-0"
				},
				{
					"type": "arrow",
					"id": "pfeil-1"
				},
				{
					"type": "arrow",
					"id": "pfeil-2"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "caddy-t",
			"type": "text",
			"x": 351,
			"y": 195,
			"width": 198,
			"height": 60,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1931656580,
			"version": 1,
			"versionNonce": 1402304087,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "caddy:2-alpine\nTLS (Let's Encrypt)\nPorts 80, 443",
			"originalText": "caddy:2-alpine\nTLS (Let's Encrypt)\nPorts 80, 443",
			"rawText": "caddy:2-alpine\nTLS (Let's Encrypt)\nPorts 80, 443",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "caddy",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "appP",
			"type": "rectangle",
			"x": 40,
			"y": 350,
			"width": 330,
			"height": 90,
			"angle": 0,
			"strokeColor": "#1971c2",
			"backgroundColor": "#d0ebff",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 1936030137,
			"version": 1,
			"versionNonce": 2064876628,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "appP-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-1"
				},
				{
					"type": "arrow",
					"id": "pfeil-3"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "appP-t",
			"type": "text",
			"x": 46,
			"y": 365,
			"width": 318,
			"height": 60,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 353718330,
			"version": 1,
			"versionNonce": 1842513780,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "app · ghcr.io/…/atlas-mentis:main-‹sha›\nNode 22 · Fastify + Angular-Build\n127.0.0.1:8080",
			"originalText": "app · ghcr.io/…/atlas-mentis:main-‹sha›\nNode 22 · Fastify + Angular-Build\n127.0.0.1:8080",
			"rawText": "app · ghcr.io/…/atlas-mentis:main-‹sha›\nNode 22 · Fastify + Angular-Build\n127.0.0.1:8080",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "appP",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "dbP",
			"type": "rectangle",
			"x": 105,
			"y": 500,
			"width": 200,
			"height": 70,
			"angle": 0,
			"strokeColor": "#2f9e44",
			"backgroundColor": "#d3f9d8",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 1947433875,
			"version": 1,
			"versionNonce": 631416347,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "dbP-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-3"
				},
				{
					"type": "arrow",
					"id": "pfeil-5"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "dbP-t",
			"type": "text",
			"x": 111,
			"y": 515,
			"width": 188,
			"height": 40,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 2010567813,
			"version": 1,
			"versionNonce": 890442452,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "db · postgres:17-alpine\n./daten/db",
			"originalText": "db · postgres:17-alpine\n./daten/db",
			"rawText": "db · postgres:17-alpine\n./daten/db",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "dbP",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "appD",
			"type": "rectangle",
			"x": 530,
			"y": 350,
			"width": 330,
			"height": 90,
			"angle": 0,
			"strokeColor": "#1971c2",
			"backgroundColor": "#d0ebff",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 662405787,
			"version": 1,
			"versionNonce": 1105724094,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "appD-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-2"
				},
				{
					"type": "arrow",
					"id": "pfeil-4"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "appD-t",
			"type": "text",
			"x": 536,
			"y": 375,
			"width": 318,
			"height": 40,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 849178936,
			"version": 1,
			"versionNonce": 1696049367,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "app · ghcr.io/…/atlas-mentis:preprod-‹sha›\n127.0.0.1:8081 · noindex",
			"originalText": "app · ghcr.io/…/atlas-mentis:preprod-‹sha›\n127.0.0.1:8081 · noindex",
			"rawText": "app · ghcr.io/…/atlas-mentis:preprod-‹sha›\n127.0.0.1:8081 · noindex",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "appD",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "dbD",
			"type": "rectangle",
			"x": 595,
			"y": 500,
			"width": 200,
			"height": 70,
			"angle": 0,
			"strokeColor": "#2f9e44",
			"backgroundColor": "#d3f9d8",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 1479919876,
			"version": 1,
			"versionNonce": 1168816941,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "dbD-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-4"
				},
				{
					"type": "arrow",
					"id": "pfeil-6"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "dbD-t",
			"type": "text",
			"x": 601,
			"y": 515,
			"width": 188,
			"height": 40,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1272185027,
			"version": 1,
			"versionNonce": 201068705,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "db · postgres:17-alpine\n./daten/db-preprod",
			"originalText": "db · postgres:17-alpine\n./daten/db-preprod",
			"rawText": "db · postgres:17-alpine\n./daten/db-preprod",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "dbD",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "cron",
			"type": "rectangle",
			"x": 400,
			"y": 520,
			"width": 100,
			"height": 60,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "#f1f3f5",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 3
			},
			"seed": 1308858262,
			"version": 1,
			"versionNonce": 928270262,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "cron-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-5"
				},
				{
					"type": "arrow",
					"id": "pfeil-6"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "cron-t",
			"type": "text",
			"x": 406,
			"y": 530,
			"width": 88,
			"height": 40,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1287522347,
			"version": 1,
			"versionNonce": 1814467857,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "cron 03:17\npg_dump",
			"originalText": "cron 03:17\npg_dump",
			"rawText": "cron 03:17\npg_dump",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "cron",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "pfeil-0",
			"type": "arrow",
			"x": 450,
			"y": 70,
			"width": 0,
			"height": 120,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 1057382352,
			"version": 1,
			"versionNonce": 1659675143,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "pfeil-0-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					0,
					120
				]
			],
			"startBinding": {
				"elementId": "user",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "caddy",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-0-t",
			"type": "text",
			"x": 370,
			"y": 113.75,
			"width": 160,
			"height": 32.5,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 153892771,
			"version": 1,
			"versionNonce": 412013968,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "atlas.‹domain›\ndev.atlas.‹domain›",
			"originalText": "atlas.‹domain›\ndev.atlas.‹domain›",
			"rawText": "atlas.‹domain›\ndev.atlas.‹domain›",
			"fontSize": 13,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "pfeil-0",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 12
		},
		{
			"id": "pfeil-1",
			"type": "arrow",
			"x": 399.55882352941177,
			"y": 260,
			"width": 129.70588235294116,
			"height": 90,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 480194461,
			"version": 1,
			"versionNonce": 1675824860,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "pfeil-1-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					-129.70588235294116,
					90
				]
			],
			"startBinding": {
				"elementId": "caddy",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "appP",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-1-t",
			"type": "text",
			"x": 254.70588235294122,
			"y": 296.875,
			"width": 160,
			"height": 16.25,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 180318217,
			"version": 1,
			"versionNonce": 389431516,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "127.0.0.1:8080",
			"originalText": "127.0.0.1:8080",
			"rawText": "127.0.0.1:8080",
			"fontSize": 13,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "pfeil-1",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 12
		},
		{
			"id": "pfeil-2",
			"type": "arrow",
			"x": 500.44117647058823,
			"y": 260,
			"width": 129.70588235294116,
			"height": 90,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 1324346645,
			"version": 1,
			"versionNonce": 1243696899,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "pfeil-2-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					129.70588235294116,
					90
				]
			],
			"startBinding": {
				"elementId": "caddy",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "appD",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-2-t",
			"type": "text",
			"x": 485.2941176470588,
			"y": 296.875,
			"width": 160,
			"height": 16.25,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1587659744,
			"version": 1,
			"versionNonce": 674592135,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "127.0.0.1:8081",
			"originalText": "127.0.0.1:8081",
			"rawText": "127.0.0.1:8081",
			"fontSize": 13,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "pfeil-2",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 12
		},
		{
			"id": "pfeil-3",
			"type": "arrow",
			"x": 205,
			"y": 440,
			"width": 0,
			"height": 60,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 942409124,
			"version": 1,
			"versionNonce": 884730203,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "pfeil-3-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					0,
					60
				]
			],
			"startBinding": {
				"elementId": "appP",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "dbP",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-3-t",
			"type": "text",
			"x": 125,
			"y": 461.875,
			"width": 160,
			"height": 16.25,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1951824771,
			"version": 1,
			"versionNonce": 2130959757,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "DATABASE_URL",
			"originalText": "DATABASE_URL",
			"rawText": "DATABASE_URL",
			"fontSize": 13,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "pfeil-3",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 12
		},
		{
			"id": "pfeil-4",
			"type": "arrow",
			"x": 695,
			"y": 440,
			"width": 0,
			"height": 60,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 1239222494,
			"version": 1,
			"versionNonce": 352020689,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "pfeil-4-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					0,
					60
				]
			],
			"startBinding": {
				"elementId": "appD",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "dbD",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-4-t",
			"type": "text",
			"x": 615,
			"y": 461.875,
			"width": 160,
			"height": 16.25,
			"angle": 0,
			"strokeColor": "#495057",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "solid",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": null,
			"seed": 1500063655,
			"version": 1,
			"versionNonce": 719080959,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "DATABASE_URL",
			"originalText": "DATABASE_URL",
			"rawText": "DATABASE_URL",
			"fontSize": 13,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "pfeil-4",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 12
		},
		{
			"id": "pfeil-5",
			"type": "arrow",
			"x": 400,
			"y": 546.9387755102041,
			"width": 95,
			"height": 5.816326530612287,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 978785428,
			"version": 1,
			"versionNonce": 163677341,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					-95,
					-5.816326530612287
				]
			],
			"startBinding": {
				"elementId": "cron",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "dbP",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-6",
			"type": "arrow",
			"x": 500,
			"y": 546.9387755102041,
			"width": 95,
			"height": 5.816326530612287,
			"angle": 0,
			"strokeColor": "#1e1e1e",
			"backgroundColor": "transparent",
			"fillStyle": "solid",
			"strokeWidth": 1,
			"strokeStyle": "dashed",
			"roughness": 0,
			"opacity": 100,
			"groupIds": [],
			"frameId": null,
			"roundness": {
				"type": 2
			},
			"seed": 276590098,
			"version": 1,
			"versionNonce": 374787159,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"points": [
				[
					0,
					0
				],
				[
					95,
					-5.816326530612287
				]
			],
			"startBinding": {
				"elementId": "cron",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "dbD",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		}
	],
	"appState": {
		"gridSize": 20,
		"viewBackgroundColor": "#ffffff"
	},
	"files": {}
}
```
%%
