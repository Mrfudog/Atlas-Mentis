---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'

# Excalidraw Data

## Text Elements
Register — Zeilen, nicht Code ^rahmen-0-t

Bestand — die Artikel ^rahmen-1-t

Lesen — die Reihenfolge ist die Regel ^rahmen-2-t

Typ · InterfaceDef
extends, area, views ^typ-t

Feld · PropertySchema
Form, enumRef, unit, target ^feld-t

Kantenart · RelationDef
from, to, asField ^kart-t

Aufzählung · Einheit
Variable · Einstellung ^enum-t

Ansicht + Anordnung
fünf Orte und eigene ^view-t

Artikel (Peg)
id · interfaces ^art-t

Karte je Typ
components[Typ] ^karte-t

Kante
nur vorwärts gespeichert ^kante-t

Ebene · Stapel
inLayer, activates, partOf ^ebene-t

1. Steht er im Stapel?
inPlay (stack.ts) ^s1-t

2. Darf er an dich?
articleVisible ^s2-t

3. Welche Felder?
redactEntity ^s3-t

4. Vorlage darunter, Werte rechnen
resolveInstance · calc.ts ^s4-t

5. Zeichnen
anordnen · Layout-Elemente ^s5-t

erklärt ^pfeil-0-t

Werte der Felder ^pfeil-2-t

Art ^pfeil-3-t

gelesen ^pfeil-4-t

Karte, Kante und Ebene gehören zum Artikel; die Kante liegt nur an ihrem Ausgang. Geschrieben wird durch validateEntity;
abgeleitete Werte und Masse werden beim Lesen gerechnet, nie gespeichert (D8). ^text-0

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
			"y": 0,
			"width": 270,
			"height": 530,
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
			"y": 6,
			"width": 250,
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
			"text": "Register — Zeilen, nicht Code",
			"originalText": "Register — Zeilen, nicht Code",
			"rawText": "Register — Zeilen, nicht Code",
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
			"x": 300,
			"y": 0,
			"width": 260,
			"height": 430,
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
			"x": 310,
			"y": 6,
			"width": 240,
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
			"text": "Bestand — die Artikel",
			"originalText": "Bestand — die Artikel",
			"rawText": "Bestand — die Artikel",
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
			"x": 620,
			"y": 0,
			"width": 300,
			"height": 530,
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
			"x": 630,
			"y": 6,
			"width": 280,
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
			"text": "Lesen — die Reihenfolge ist die Regel",
			"originalText": "Lesen — die Reihenfolge ist die Regel",
			"rawText": "Lesen — die Reihenfolge ist die Regel",
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
			"id": "typ",
			"type": "rectangle",
			"x": 20,
			"y": 50,
			"width": 220,
			"height": 60,
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
			"seed": 1250328747,
			"version": 1,
			"versionNonce": 1738531149,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "typ-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-0"
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
			"id": "typ-t",
			"type": "text",
			"x": 26,
			"y": 60,
			"width": 208,
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
			"seed": 1271135913,
			"version": 1,
			"versionNonce": 1098894339,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Typ · InterfaceDef\nextends, area, views",
			"originalText": "Typ · InterfaceDef\nextends, area, views",
			"rawText": "Typ · InterfaceDef\nextends, area, views",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "typ",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "feld",
			"type": "rectangle",
			"x": 20,
			"y": 150,
			"width": 230,
			"height": 60,
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
			"seed": 1882556969,
			"version": 1,
			"versionNonce": 2136927794,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "feld-t"
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
			"id": "feld-t",
			"type": "text",
			"x": 26,
			"y": 160,
			"width": 218,
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
			"text": "Feld · PropertySchema\nForm, enumRef, unit, target",
			"originalText": "Feld · PropertySchema\nForm, enumRef, unit, target",
			"rawText": "Feld · PropertySchema\nForm, enumRef, unit, target",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "feld",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "kart",
			"type": "rectangle",
			"x": 20,
			"y": 250,
			"width": 220,
			"height": 60,
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
			"seed": 638022372,
			"version": 1,
			"versionNonce": 914937185,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "kart-t"
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
			"id": "kart-t",
			"type": "text",
			"x": 26,
			"y": 260,
			"width": 208,
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
			"seed": 1931656580,
			"version": 1,
			"versionNonce": 1402304087,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Kantenart · RelationDef\nfrom, to, asField",
			"originalText": "Kantenart · RelationDef\nfrom, to, asField",
			"rawText": "Kantenart · RelationDef\nfrom, to, asField",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "kart",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "enum",
			"type": "rectangle",
			"x": 20,
			"y": 350,
			"width": 220,
			"height": 60,
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
					"id": "enum-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "enum-t",
			"type": "text",
			"x": 26,
			"y": 360,
			"width": 208,
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
			"seed": 353718330,
			"version": 1,
			"versionNonce": 1842513780,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Aufzählung · Einheit\nVariable · Einstellung",
			"originalText": "Aufzählung · Einheit\nVariable · Einstellung",
			"rawText": "Aufzählung · Einheit\nVariable · Einstellung",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "enum",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "view",
			"type": "rectangle",
			"x": 20,
			"y": 450,
			"width": 230,
			"height": 60,
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
			"seed": 1947433875,
			"version": 1,
			"versionNonce": 631416347,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "view-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-9"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "view-t",
			"type": "text",
			"x": 26,
			"y": 460,
			"width": 218,
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
			"text": "Ansicht + Anordnung\nfünf Orte und eigene",
			"originalText": "Ansicht + Anordnung\nfünf Orte und eigene",
			"rawText": "Ansicht + Anordnung\nfünf Orte und eigene",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "view",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "art",
			"type": "rectangle",
			"x": 320,
			"y": 50,
			"width": 220,
			"height": 60,
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
			"seed": 662405787,
			"version": 1,
			"versionNonce": 1105724094,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "art-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-1"
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
			"id": "art-t",
			"type": "text",
			"x": 326,
			"y": 60,
			"width": 208,
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
			"text": "Artikel (Peg)\nid · interfaces",
			"originalText": "Artikel (Peg)\nid · interfaces",
			"rawText": "Artikel (Peg)\nid · interfaces",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "art",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "karte",
			"type": "rectangle",
			"x": 320,
			"y": 150,
			"width": 220,
			"height": 60,
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
			"seed": 1479919876,
			"version": 1,
			"versionNonce": 1168816941,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "karte-t"
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
			"id": "karte-t",
			"type": "text",
			"x": 326,
			"y": 160,
			"width": 208,
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
			"text": "Karte je Typ\ncomponents[Typ]",
			"originalText": "Karte je Typ\ncomponents[Typ]",
			"rawText": "Karte je Typ\ncomponents[Typ]",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "karte",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "kante",
			"type": "rectangle",
			"x": 320,
			"y": 250,
			"width": 220,
			"height": 60,
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
			"seed": 1308858262,
			"version": 1,
			"versionNonce": 928270262,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "kante-t"
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
			"id": "kante-t",
			"type": "text",
			"x": 326,
			"y": 260,
			"width": 208,
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
			"text": "Kante\nnur vorwärts gespeichert",
			"originalText": "Kante\nnur vorwärts gespeichert",
			"rawText": "Kante\nnur vorwärts gespeichert",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "kante",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "ebene",
			"type": "rectangle",
			"x": 320,
			"y": 350,
			"width": 220,
			"height": 60,
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
			"seed": 1057382352,
			"version": 1,
			"versionNonce": 1659675143,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "ebene-t"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "ebene-t",
			"type": "text",
			"x": 326,
			"y": 360,
			"width": 208,
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
			"seed": 153892771,
			"version": 1,
			"versionNonce": 412013968,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Ebene · Stapel\ninLayer, activates, partOf",
			"originalText": "Ebene · Stapel\ninLayer, activates, partOf",
			"rawText": "Ebene · Stapel\ninLayer, activates, partOf",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "ebene",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "s1",
			"type": "rectangle",
			"x": 640,
			"y": 50,
			"width": 260,
			"height": 60,
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
			"seed": 480194461,
			"version": 1,
			"versionNonce": 1675824860,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "s1-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-4"
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
			"id": "s1-t",
			"type": "text",
			"x": 646,
			"y": 60,
			"width": 248,
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
			"seed": 180318217,
			"version": 1,
			"versionNonce": 389431516,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "1. Steht er im Stapel?\ninPlay (stack.ts)",
			"originalText": "1. Steht er im Stapel?\ninPlay (stack.ts)",
			"rawText": "1. Steht er im Stapel?\ninPlay (stack.ts)",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "s1",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "s2",
			"type": "rectangle",
			"x": 640,
			"y": 150,
			"width": 260,
			"height": 60,
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
			"seed": 1324346645,
			"version": 1,
			"versionNonce": 1243696899,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "s2-t"
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
			"id": "s2-t",
			"type": "text",
			"x": 646,
			"y": 160,
			"width": 248,
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
			"seed": 1587659744,
			"version": 1,
			"versionNonce": 674592135,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "2. Darf er an dich?\narticleVisible",
			"originalText": "2. Darf er an dich?\narticleVisible",
			"rawText": "2. Darf er an dich?\narticleVisible",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "s2",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "s3",
			"type": "rectangle",
			"x": 640,
			"y": 250,
			"width": 260,
			"height": 60,
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
			"seed": 942409124,
			"version": 1,
			"versionNonce": 884730203,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "s3-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-6"
				},
				{
					"type": "arrow",
					"id": "pfeil-7"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "s3-t",
			"type": "text",
			"x": 646,
			"y": 260,
			"width": 248,
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
			"seed": 1951824771,
			"version": 1,
			"versionNonce": 2130959757,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "3. Welche Felder?\nredactEntity",
			"originalText": "3. Welche Felder?\nredactEntity",
			"rawText": "3. Welche Felder?\nredactEntity",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "s3",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "s4",
			"type": "rectangle",
			"x": 640,
			"y": 350,
			"width": 260,
			"height": 60,
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
			"seed": 1239222494,
			"version": 1,
			"versionNonce": 352020689,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "s4-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-7"
				},
				{
					"type": "arrow",
					"id": "pfeil-8"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "s4-t",
			"type": "text",
			"x": 646,
			"y": 360,
			"width": 248,
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
			"seed": 1500063655,
			"version": 1,
			"versionNonce": 719080959,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "4. Vorlage darunter, Werte rechnen\nresolveInstance · calc.ts",
			"originalText": "4. Vorlage darunter, Werte rechnen\nresolveInstance · calc.ts",
			"rawText": "4. Vorlage darunter, Werte rechnen\nresolveInstance · calc.ts",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "s4",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "s5",
			"type": "rectangle",
			"x": 640,
			"y": 450,
			"width": 260,
			"height": 60,
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
			"seed": 978785428,
			"version": 1,
			"versionNonce": 163677341,
			"isDeleted": false,
			"boundElements": [
				{
					"type": "text",
					"id": "s5-t"
				},
				{
					"type": "arrow",
					"id": "pfeil-8"
				},
				{
					"type": "arrow",
					"id": "pfeil-9"
				}
			],
			"updated": 1,
			"link": null,
			"locked": false
		},
		{
			"id": "s5-t",
			"type": "text",
			"x": 646,
			"y": 460,
			"width": 248,
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
			"seed": 276590098,
			"version": 1,
			"versionNonce": 374787159,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "5. Zeichnen\nanordnen · Layout-Elemente",
			"originalText": "5. Zeichnen\nanordnen · Layout-Elemente",
			"rawText": "5. Zeichnen\nanordnen · Layout-Elemente",
			"fontSize": 16,
			"fontFamily": 2,
			"textAlign": "center",
			"verticalAlign": "middle",
			"containerId": "s5",
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 14
		},
		{
			"id": "pfeil-0",
			"type": "arrow",
			"x": 131.5,
			"y": 110,
			"width": 2,
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
			"roundness": {
				"type": 2
			},
			"seed": 948709761,
			"version": 1,
			"versionNonce": 80100956,
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
					2,
					40
				]
			],
			"startBinding": {
				"elementId": "typ",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "feld",
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
			"x": 52.5,
			"y": 121.875,
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
			"seed": 1082682476,
			"version": 1,
			"versionNonce": 1003765604,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "erklärt",
			"originalText": "erklärt",
			"rawText": "erklärt",
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
			"x": 430,
			"y": 110,
			"width": 0,
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
			"roundness": {
				"type": 2
			},
			"seed": 1243427070,
			"version": 1,
			"versionNonce": 1447645967,
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
					0,
					40
				]
			],
			"startBinding": {
				"elementId": "art",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "karte",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-2",
			"type": "arrow",
			"x": 340,
			"y": 150,
			"width": 120,
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
			"roundness": {
				"type": 2
			},
			"seed": 200599677,
			"version": 1,
			"versionNonce": 143244144,
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
					-120,
					-40
				]
			],
			"startBinding": {
				"elementId": "karte",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "typ",
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
			"x": 200,
			"y": 121.875,
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
			"seed": 1788215331,
			"version": 1,
			"versionNonce": 837051536,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Werte der Felder",
			"originalText": "Werte der Felder",
			"rawText": "Werte der Felder",
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
			"x": 320,
			"y": 280,
			"width": 80,
			"height": 0,
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
			"seed": 409875951,
			"version": 1,
			"versionNonce": 355190910,
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
					-80,
					0
				]
			],
			"startBinding": {
				"elementId": "kante",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "kart",
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
			"x": 200,
			"y": 271.875,
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
			"seed": 2058462609,
			"version": 1,
			"versionNonce": 2127735996,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Art",
			"originalText": "Art",
			"rawText": "Art",
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
			"x": 540,
			"y": 80,
			"width": 100,
			"height": 0,
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
			"seed": 243877847,
			"version": 1,
			"versionNonce": 1869683330,
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
					100,
					0
				]
			],
			"startBinding": {
				"elementId": "art",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s1",
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
			"x": 510,
			"y": 71.875,
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
			"seed": 1336273608,
			"version": 1,
			"versionNonce": 1444510476,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "gelesen",
			"originalText": "gelesen",
			"rawText": "gelesen",
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
			"x": 770,
			"y": 110,
			"width": 0,
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
			"roundness": {
				"type": 2
			},
			"seed": 1318652553,
			"version": 1,
			"versionNonce": 1262088783,
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
					0,
					40
				]
			],
			"startBinding": {
				"elementId": "s1",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s2",
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
			"x": 770,
			"y": 210,
			"width": 0,
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
			"roundness": {
				"type": 2
			},
			"seed": 324062450,
			"version": 1,
			"versionNonce": 547639202,
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
					0,
					40
				]
			],
			"startBinding": {
				"elementId": "s2",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s3",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-7",
			"type": "arrow",
			"x": 770,
			"y": 310,
			"width": 0,
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
			"roundness": {
				"type": 2
			},
			"seed": 1715708819,
			"version": 1,
			"versionNonce": 1273555394,
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
					0,
					40
				]
			],
			"startBinding": {
				"elementId": "s3",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s4",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-8",
			"type": "arrow",
			"x": 770,
			"y": 410,
			"width": 0,
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
			"roundness": {
				"type": 2
			},
			"seed": 1925544752,
			"version": 1,
			"versionNonce": 583514338,
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
					0,
					40
				]
			],
			"startBinding": {
				"elementId": "s4",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s5",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "pfeil-9",
			"type": "arrow",
			"x": 250,
			"y": 480,
			"width": 390,
			"height": 0,
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
			"seed": 425095546,
			"version": 1,
			"versionNonce": 580853881,
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
					390,
					0
				]
			],
			"startBinding": {
				"elementId": "view",
				"focus": 0,
				"gap": 4
			},
			"endBinding": {
				"elementId": "s5",
				"focus": 0,
				"gap": 4
			},
			"startArrowhead": null,
			"endArrowhead": "arrow",
			"lastCommittedPoint": null
		},
		{
			"id": "text-0",
			"type": "text",
			"x": 0,
			"y": 550,
			"width": 900,
			"height": 35,
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
			"seed": 851194519,
			"version": 1,
			"versionNonce": 206008598,
			"isDeleted": false,
			"boundElements": [],
			"updated": 1,
			"link": null,
			"locked": false,
			"text": "Karte, Kante und Ebene gehören zum Artikel; die Kante liegt nur an ihrem Ausgang. Geschrieben wird durch validateEntity;\nabgeleitete Werte und Masse werden beim Lesen gerechnet, nie gespeichert (D8).",
			"originalText": "Karte, Kante und Ebene gehören zum Artikel; die Kante liegt nur an ihrem Ausgang. Geschrieben wird durch validateEntity;\nabgeleitete Werte und Masse werden beim Lesen gerechnet, nie gespeichert (D8).",
			"rawText": "Karte, Kante und Ebene gehören zum Artikel; die Kante liegt nur an ihrem Ausgang. Geschrieben wird durch validateEntity;\nabgeleitete Werte und Masse werden beim Lesen gerechnet, nie gespeichert (D8).",
			"fontSize": 14,
			"fontFamily": 2,
			"textAlign": "left",
			"verticalAlign": "top",
			"containerId": null,
			"autoResize": true,
			"lineHeight": 1.25,
			"baseline": 13
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
