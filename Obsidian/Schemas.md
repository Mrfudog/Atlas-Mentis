---
tags: [vtt, data, schema]
status: living
version: 1.2
updated: 2026-09-05
related: [[32_Data_Definitions]], [[35_Data_Architecture_Overview]], [[20_Decision_Log]]
---

# Schemas

Machine-readable counterpart to [[32_Data_Definitions]]. Every component, interface, relation, projection and event has one entry here; change this file when the registry changes and log it in [[#8. Changelog]]. Format: JSON Schema draft 2020-12; `$id` values are the registry keys (`component/…`, `value/…`, `iface/…`, `rel/…`, `event/…`).

Model in one line: **entity = ID · component = one typed payload per entity · interface = required/optional components + block types + relations · relation = typed edge with props.**

Decisions that shape this file are tracked in [[#7. Decisions]]; entries marked ⚠ follow the proposed default until decided.

Jump: [[#1. Meta-schemas]] · [[#2. Value types]] · [[#3. Components]] · [[#4. Interfaces]] · [[#5. Global relations]] · [[#6. Projections and events]] · [[#7. Decisions]] · [[#8. Changelog]]

## 1. Meta-schemas

### 1.1 Component definition (a row in `component_def`)
```json
{ "$id": "meta/component", "type": "object", "required": ["name", "schema"], "additionalProperties": false,
  "properties": {
    "name":   { "type": "string", "pattern": "^[A-Z][A-Za-z]+$" },
    "engine": { "type": ["string", "null"], "description": "engine that owns the meaning; null = plain data" },
    "schema": { "$ref": "https://json-schema.org/draft/2020-12/schema" },
    "single": { "type": "boolean", "const": true, "description": "components are always single-valued per entity" }
  } }
```
⚠ D1: no `kind` field — `engine` alone distinguishes plain data from engine-owned data.

### 1.2 Interface definition (a row in `interface`)
```json
{ "$id": "meta/interface", "type": "object", "required": ["name", "requires"], "additionalProperties": false,
  "properties": {
    "name":       { "type": "string", "pattern": "^[A-Z][A-Za-z]+$" },
    "extends":    { "type": "array", "items": { "type": "string" }, "default": [] },
    "requires":   { "type": "array", "items": { "type": "string" } },
    "allows":     { "type": "array", "items": { "type": "string" }, "default": [] },
    "blockTypes": { "type": "array", "items": { "type": "string" }, "default": [] },
    "relations":  { "type": "object", "additionalProperties": { "$ref": "meta/relation" } } } }
```
Inheritance: `requires`, `allows`, `blockTypes` and `relations` of `extends` are unioned in. A `+x` entry in `blockTypes` means "add to inherited"; a plain list replaces. ⚠ D2: `allows` is strict — a component not in requires ∪ allows is rejected unless the campaign has `expertMode: true`.

### 1.3 Relation definition (inside an interface, or a row in `relation_def`)
```json
{ "$id": "meta/relation", "type": "object", "required": ["to"], "additionalProperties": false,
  "properties": {
    "from":        { "type": "array", "items": { "type": "string" }, "description": "only for global relations; '*' = any" },
    "to":          { "type": "array", "items": { "type": "string" }, "description": "target interfaces; '*' any, 'same' = same as source" },
    "owned":       { "type": "boolean", "default": false, "description": "target is deleted with source" },
    "cardinality": { "enum": ["one", "many"], "default": "many" },
    "props":       { "$ref": "https://json-schema.org/draft/2020-12/schema" },
    "derived":     { "type": "boolean", "default": false, "description": "written by an engine, never by hand" } } }
```

### 1.4 Renderer definition (a row in `renderer_def`) — D11
```json
{ "$id": "meta/renderer", "type": "object", "required": ["name", "appliesTo", "facets"], "additionalProperties": false,
  "properties": {
    "name":            { "type": "string" },
    "appliesTo":       { "type": "array", "items": { "type": "string" }, "description": "interfaces" },
    "reads":           { "type": "array", "items": { "type": "string" }, "description": "component defs" },
    "facets":          { "type": "object", "additionalProperties": { "type": "object" }, "description": "facet → drawing template / source; a template may carry per-medium variants" },
    "media":           { "type": "array", "items": { "enum": ["screen", "print", "pdf", "image"] }, "default": ["screen"], "description": "output media this renderer serves (D17)" },
    "defaultPriority": { "type": "integer", "default": 0 } } }
```
Renderers read and draw; they emit no events and never call each other — not engines. Print & export (D17, REQ-167): the Export engine resolves a facet as usual, picks the `print`/`pdf`/`image` template variant and renders to file; page assembly is export configuration.

## 2. Value types
```json
{ "$id": "value/Facet", "enum": ["short", "description", "full", "image", "token", "map", "link"], "description": "system-wide display levels (D14, REQ-164); open enum, extend via registry" }
```

Reused inside components; never attached to an entity directly.

```json
{ "$id": "value/LocalizedText", "type": "object", "minProperties": 1,
  "propertyNames": { "pattern": "^[a-z]{2}(-[A-Z]{2})?$" }, "additionalProperties": { "type": "string" },
  "examples": [{ "de": "Kampfstab", "en": "Quarterstaff" }] }
```
```json
{ "$id": "value/RichText", "type": "object", "anyOf": [{ "required": ["raw"] }, { "required": ["text"] }],
  "properties": { "raw": { "type": "string" }, "text": { "$ref": "value/LocalizedText" }, "format": { "enum": ["obsidian", "markdown", "plain"], "default": "obsidian" } } }
```
```json
{ "$id": "value/WorldDate", "type": "object", "required": ["canonical", "display"],
  "properties": { "canonical": { "type": "integer", "description": "sortable day count; calendar-independent" }, "display": { "type": "string" }, "calendarId": { "type": "string", "format": "uuid" } } }
```
```json
{ "$id": "value/DiceExpression", "type": "string", "pattern": "^(\\d*d\\d+|\\d+)(\\s*[+-]\\s*(\\d*d\\d+|\\d+))*$", "examples": ["2d6+3", "d100", "27"] }
```
```json
{ "$id": "value/Ref", "type": "string", "format": "uuid", "description": "entity id; used only where a component legitimately points at another entity" }
```
```json
{ "$id": "value/Effect", "type": "object", "required": ["type"],
  "properties": { "type": { "type": "string", "examples": ["grant_proficiency", "grant_resistance", "bonus", "constraint", "text"] }, "payload": { "type": "object" }, "manual": { "type": "boolean", "default": false } },
  "description": "open list; consumers ignore unknown types" }
```

## 3. Components

Column `engine` = owning engine (null = plain data). All schemas set `additionalProperties: false` unless stated.

### 3.1 Structural
```json
{ "$id": "component/Typed", "engine": "Validation", "type": "object", "required": ["interfaces"],
  "properties": { "interfaces": { "type": "array", "minItems": 1, "items": { "type": "string" } } } }
```
⚠ D5: interface membership is asserted via `Typed` and checked by Validation, not derived from present components.
```json
{ "$id": "component/Identity", "engine": "Resolution", "type": "object", "required": ["key"],
  "properties": { "key": { "type": "string", "pattern": "^[a-z]+/[a-z0-9-]+(/[a-z0-9-]+)*$", "examples": ["creature/rina-von-immerwald", "item/kampfstab"] },
                  "aliases": { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
                  "successorId": { "$ref": "value/Ref" } } }
```
⚠ D3: `key` is unique **per layer** (`unique (layer, key)` enforced via the partOf Entry), so two layers may both define `creature/goblin`; the stack decides.
```json
{ "$id": "component/Name", "type": "object", "required": ["text"],
  "properties": { "text": { "$ref": "value/LocalizedText" }, "short": { "$ref": "value/LocalizedText" } } }
```
```json
{ "$id": "component/Description", "$ref": "value/RichText" }
```
```json
{ "$id": "component/Block", "engine": "Rendering", "type": "object", "required": ["blockType", "body"],
  "properties": { "blockType": { "type": "string", "examples": ["paragraph", "readaloud", "fact", "secret", "tactics", "appearance", "personality", "lore", "poem", "song", "review", "note"] },
                  "body": { "$ref": "value/RichText" } } }
```
```json
{ "$id": "component/SourceRef", "type": "object", "required": ["layerId"],
  "properties": { "layerId": { "$ref": "value/Ref" }, "publication": { "type": "string" }, "page": { "type": "integer" }, "assetId": { "$ref": "value/Ref" }, "anchor": { "type": "string" } } }
```
```json
{ "$id": "component/Owner", "engine": "Access", "type": "object", "required": ["userId"],
  "properties": { "userId": { "$ref": "value/Ref" }, "gmMayEdit": { "type": "boolean", "default": true } } }
```

### 3.2 Dimensions (engine-owned, sparse)
```json
{ "$id": "component/Visibility", "engine": "Access", "type": "object", "required": ["audience"],
  "properties": { "audience": { "enum": ["gm", "campaign", "players", "public"] },
                  "revealedTo": { "type": "array", "items": { "$ref": "value/Ref" } },
                  "hiddenFrom": { "type": "array", "items": { "$ref": "value/Ref" } },
                  "inherit": { "type": "boolean", "default": true } } }
```
⚠ D7: `inherit: true` means children without their own Visibility take this one (evaluated by Resolution).
```json
{ "$id": "component/Status", "engine": "Status", "type": "object", "required": ["value"],
  "properties": { "value": { "enum": ["idea", "planned", "used", "discarded"] }, "changedAt": { "type": "string", "format": "date-time" } } }
```
```json
{ "$id": "component/KnowledgeRequirement", "engine": "Knowledge", "type": "object", "required": ["tags"],
  "properties": { "tags": { "type": "array", "minItems": 1, "items": { "$ref": "value/Ref" } }, "mode": { "enum": ["all", "any"], "default": "all" } } }
```
```json
{ "$id": "component/TemporalValidity", "engine": "Knowledge", "type": "object", "minProperties": 1,
  "properties": { "from": { "$ref": "value/WorldDate" }, "until": { "$ref": "value/WorldDate" }, "afterTag": { "$ref": "value/Ref" } } }
```

### 3.3 Rules and mechanics
```json
{ "$id": "component/Statblock", "engine": "Calculation", "type": "object", "required": ["system"], "additionalProperties": true,
  "properties": { "system": { "type": "string", "examples": ["dnd5e-2014", "dnd5e-2024", "homebrew"] },
    "raw": { "type": "string" },
    "size": { "enum": ["tiny", "small", "medium", "large", "huge", "gargantuan"] }, "type": { "type": "string" }, "alignment": { "type": "string" },
    "ac": { "type": "integer" }, "hp": { "type": "object", "properties": { "average": { "type": "integer" }, "formula": { "$ref": "value/DiceExpression" } } },
    "speed": { "type": "object", "additionalProperties": { "type": "integer" } },
    "abilities": { "type": "object", "properties": { "str": { "type": "integer" }, "dex": { "type": "integer" }, "con": { "type": "integer" }, "int": { "type": "integer" }, "wis": { "type": "integer" }, "cha": { "type": "integer" } } },
    "saves": { "type": "object", "additionalProperties": { "type": "integer" } }, "skills": { "type": "object", "additionalProperties": { "type": "integer" } },
    "senses": { "type": "array", "items": { "type": "string" } }, "languages": { "type": "array", "items": { "type": "string" } },
    "cr": { "type": "number" }, "level": { "type": "integer" }, "proficiencyBonus": { "type": "integer" },
    "fightingType": { "type": "string", "description": "MCDM role, e.g. Plänkler" } } }
```
`additionalProperties: true` on purpose: per-system fields (homebrew) live here until a Rules engine formalises them. **D4 (decided 2026-09-02): Statblock is an entity** — this component is its mechanics card on the statblock peg; Creature references it via `hasStatblock` (shareable, versionable, layerable); rule elements hang off the statblock peg through `composedOf`, not embedded.
```json
{ "$id": "component/Effects", "engine": "Calculation", "type": "object", "required": ["items"],
  "properties": { "items": { "type": "array", "items": { "$ref": "value/Effect" } } } }
```
```json
{ "$id": "component/Rarity", "type": "object", "required": ["value"], "properties": { "value": { "enum": ["gewöhnlich", "ungewöhnlich", "selten", "mythisch", "legendär"] } } }
```
```json
{ "$id": "component/SpellInfo", "type": "object", "required": ["level", "school"],
  "properties": { "level": { "type": "integer", "minimum": 0, "maximum": 9 }, "school": { "type": "string" }, "castingTime": { "type": "string" }, "range": { "type": "string" }, "components": { "type": "array", "items": { "enum": ["V", "S", "M"] } }, "material": { "type": "string" }, "duration": { "type": "string" }, "concentration": { "type": "boolean" }, "ritual": { "type": "boolean" } } }
```
```json
{ "$id": "component/RuleInfo", "type": "object", "required": ["kind"],
  "properties": { "kind": { "enum": ["action", "bonus", "reaction", "feature", "trait", "condition", "legendary", "lair"] }, "uses": { "type": "string" }, "recharge": { "type": "string" } } }
```
```json
{ "$id": "component/Progression", "type": "object", "description": "Class / subclass level table",
  "properties": { "hitDie": { "type": "integer" }, "levels": { "type": "array", "items": { "type": "object", "properties": { "level": { "type": "integer" }, "grants": { "type": "array", "items": { "$ref": "value/Ref" } } } } } } }
```

### 3.4 Narrative and world
```json
{ "$id": "component/ContainerType", "type": "object", "required": ["value"], "properties": { "value": { "type": "string", "examples": ["campaign", "arc", "session", "scene"] } } }
```
```json
{ "$id": "component/WorldDate", "engine": "Knowledge", "$ref": "value/WorldDate" }
```
```json
{ "$id": "component/Timestamp", "type": "object", "required": ["at"], "properties": { "at": { "type": "string", "format": "date-time" }, "until": { "type": "string", "format": "date-time" } } }
```
```json
{ "$id": "component/LayerInfo", "engine": "Resolution", "type": "object", "required": ["type"],
  "properties": { "type": { "enum": ["system", "expansion", "world", "pack", "campaign", "override-set"] }, "priority": { "type": "integer", "default": 0 }, "expertMode": { "type": "boolean", "default": false } } }
```
```json
{ "$id": "component/Settings", "type": "object", "additionalProperties": true, "description": "free key-value bag for CampaignSettings and UserPreferences" }
```
```json
{ "$id": "component/CalendarSpec", "type": "object", "properties": { "months": { "type": "array", "items": { "type": "object", "properties": { "name": { "$ref": "value/LocalizedText" }, "days": { "type": "integer" } } } }, "dayNames": { "type": "array", "items": { "$ref": "value/LocalizedText" } }, "eras": { "type": "array", "items": { "type": "object" } }, "moons": { "type": "array", "items": { "type": "object" } } } }
```
```json
{ "$id": "component/TableInfo", "type": "object", "required": ["die"], "properties": { "die": { "$ref": "value/DiceExpression" } }, "description": "LootTable / random table header; rows are yields relations" }
```

### 3.5 Play and media
```json
{ "$id": "component/AssetInfo", "engine": "Asset", "type": "object", "required": ["backend", "path", "mime"],
  "properties": { "backend": { "enum": ["app", "external"] }, "path": { "type": "string" }, "mime": { "type": "string" }, "bytes": { "type": "integer" }, "derived": { "type": "object", "additionalProperties": { "type": "string" } } } }
```
```json
{ "$id": "component/GridConfig", "type": "object", "required": ["size"], "properties": { "size": { "type": "number" }, "offsetX": { "type": "number", "default": 0 }, "offsetY": { "type": "number", "default": 0 }, "shape": { "enum": ["square", "hex"], "default": "square" }, "scale": { "type": "string", "examples": ["5 ft"] } } }
```
```json
{ "$id": "component/Coordinates", "type": "object", "required": ["mapId", "x", "y"], "properties": { "mapId": { "$ref": "value/Ref" }, "x": { "type": "number" }, "y": { "type": "number" }, "rotation": { "type": "number" }, "size": { "type": "number" } } }
```
```json
{ "$id": "component/TokenInfo", "type": "object", "required": ["kind", "lifecycle"], "properties": { "kind": { "enum": ["creature", "location", "quest", "marker"] }, "lifecycle": { "enum": ["static", "play"] } } }
```
```json
{ "$id": "component/EncounterInfo", "type": "object", "properties": { "difficulty": { "type": "string" }, "diceTable": { "$ref": "value/DiceExpression" }, "trigger": { "type": "string" } } }
```
```json
{ "$id": "component/StatePayload", "engine": "Realtime", "type": "object", "required": ["kind", "version"], "additionalProperties": true,
  "properties": { "kind": { "enum": ["initiative", "hp", "tokens", "conditions", "custom"] }, "version": { "type": "integer" } } }
```
```json
{ "$id": "component/LogEntry", "engine": "Logging", "type": "object", "required": ["event", "at"], "properties": { "event": { "type": "string" }, "at": { "type": "string", "format": "date-time" }, "actor": { "$ref": "value/Ref" }, "target": { "$ref": "value/Ref" }, "delta": { "type": "object" } } }
```
```json
{ "$id": "component/RollResult", "type": "object", "required": ["expression", "total"], "properties": { "expression": { "$ref": "value/DiceExpression" }, "total": { "type": "integer" }, "dice": { "type": "array", "items": { "type": "integer" } } } }
```

### 3.6 Access and views
```json
{ "$id": "component/Credentials", "engine": "Access", "type": "object", "required": ["login", "hash"], "properties": { "login": { "type": "string" }, "hash": { "type": "string" }, "algo": { "type": "string", "default": "argon2id" } } }
```
```json
{ "$id": "component/MembershipInfo", "engine": "Access", "type": "object", "required": ["userId", "roleId", "scopeId"], "properties": { "userId": { "$ref": "value/Ref" }, "roleId": { "$ref": "value/Ref" }, "scopeId": { "$ref": "value/Ref" } } }
```
```json
{ "$id": "component/GrantInfo", "engine": "Access", "type": "object", "required": ["userId"], "properties": { "userId": { "$ref": "value/Ref" }, "fieldGroup": { "type": "string" }, "mayShare": { "type": "boolean", "default": false } } }
```
```json
{ "$id": "component/RoleInfo", "type": "object", "required": ["code"], "properties": { "code": { "enum": ["gm", "player", "cogm", "spectator"] } } }
```
```json
{ "$id": "component/ViewConfig", "engine": "Rendering", "type": "object",
  "properties": { "mode": { "enum": ["raw", "structured", "hybrid"], "default": "hybrid" }, "fields": { "type": "array", "items": { "type": "string" } }, "resolutionPriority": { "enum": ["raw", "structured"], "default": "structured" }, "statusFilter": { "type": "array", "items": { "enum": ["idea", "planned", "used", "discarded"] } }, "language": { "type": "string" },
    "sectionLayout": { "type": "object", "additionalProperties": { "enum": ["primary", "secondary", "collapsed", "hidden"] } }, "statblockProminence": { "enum": ["full", "compact", "hidden"], "default": "full" },
    "components": { "description": "selection (2026-09-02): explicit list or '*'; can only narrow", "oneOf": [ { "const": "*" }, { "type": "array", "items": { "type": "string" } } ] },
    "blocks": { "description": "block-type selection: list, '*', or rule", "oneOf": [ { "const": "*" }, { "type": "array", "items": { "type": "string" } }, { "type": "object", "properties": { "kind": { "type": "string" }, "except": { "type": "array", "items": { "type": "string" } } } } ] },
    "relations": { "type": "object", "additionalProperties": { "type": "object", "properties": { "depth": { "type": "integer", "default": 1 } } }, "description": "which strings to follow, how deep" } } }
```
```json
{ "$id": "component/DisplayProfile", "engine": "Rendering", "type": "object", "required": ["entries"], "description": "Darstellungsprofil (D13): the entity *proposes* how it wants to be shown; resolved against board rules",
  "properties": { "entries": { "type": "array", "items": { "type": "object", "required": ["facet", "priority"],
    "properties": { "context": { "enum": ["board", "sheet", "statblock", "note", "*"], "default": "*" }, "facet": { "$ref": "value/Facet" }, "rendererRef": { "type": "string" }, "priority": { "type": "integer" } } } } } }
```
```json
{ "$id": "component/CanvasConfig", "engine": "Rendering", "type": "object", "description": "free board canvas (REQ-157, D12/D16); part of the board, not the layer system",
  "properties": {
    "placements": { "type": "array", "items": { "type": "object", "required": ["kind"],
      "properties": {
        "kind": { "enum": ["entity", "asset", "shape", "widget"], "description": "D16: peg ref · file ref · inline geometry (no peg) · interactive tool instance (creature creator, generators, …)" },
        "entityRef": { "$ref": "value/Ref" }, "assetRef": { "$ref": "value/Ref" }, "widgetRef": { "$ref": "value/Ref" },
        "shape": { "type": "object", "properties": { "form": { "type": "string", "examples": ["rect", "ellipse", "line", "arrow", "polygon", "icon"] }, "iconRef": { "$ref": "value/Ref" }, "style": { "type": "object" } } },
        "x": { "type": "number" }, "y": { "type": "number" }, "w": { "type": "number" }, "h": { "type": "number" }, "rotation": { "type": "number" }, "zIndex": { "type": "integer" },
        "facetOverride": { "$ref": "value/Facet" }, "rendererOverride": { "type": "string" }, "priorityOverride": { "type": "integer" },
        "anchorRef": { "type": "string" } } } },
    "typeRules": { "type": "array", "items": { "type": "object", "required": ["priority"],
      "properties": { "selector": { "type": "object", "properties": { "interface": { "type": "string" }, "componentValue": { "type": "object" } } }, "facet": { "$ref": "value/Facet" }, "rendererRef": { "type": "string" }, "priority": { "type": "integer" } } } },
    "anchors": { "type": "array", "items": { "type": "object", "required": ["id", "name"],
      "properties": { "id": { "type": "string" }, "name": { "type": "string" }, "x": { "type": "number" }, "y": { "type": "number" }, "zoom": { "type": "number" }, "targetFacet": { "$ref": "value/Facet" }, "visibleLayers": { "type": "array", "items": { "$ref": "value/Ref" } } } } } } }
```
Resolution (D13, REQ-161): explicit placement override → highest priority of {board typeRule, entity DisplayProfile} → tie: board rule wins → `renderer_def` default. Zoom depth / anchors map onto facets (semantic zoom, REQ-162).
```json
{ "$id": "component/WidgetInfo", "type": "object", "required": ["projection"], "properties": { "projection": { "type": "string" }, "query": { "type": "object" }, "position": { "type": "object" } } }
```
```json
{ "$id": "component/BoardInfo", "type": "object", "properties": { "device": { "enum": ["phone", "tablet", "desktop", "any"], "default": "any" }, "pages": { "type": "array", "items": { "type": "string" } } } }
```
```json
{ "$id": "component/ChangeInfo", "engine": "Logging", "type": "object", "required": ["at", "summary"], "properties": { "at": { "type": "string", "format": "date-time" }, "summary": { "type": "string" }, "diffRef": { "$ref": "value/Ref" } } }
```
```json
{ "$id": "component/TermInfo", "engine": "Linking", "type": "object", "required": ["text"], "properties": { "text": { "$ref": "value/LocalizedText" }, "kind": { "enum": ["translation", "alias"] } } }
```

## 4. Interfaces

Compact form `{name, extends, requires, allows, blockTypes, relations}`. Relation shorthand: `rel→[targets]`, `!` = owned, `1` = cardinality one, `{…}` = props schema name.

### 4.1 Base
```json
{ "name": "Base", "requires": ["Typed", "Identity"], "allows": ["Visibility", "Status", "SourceRef", "Description"],
  "relations": { "hasBlock": { "to": ["ContentBlock"], "owned": true, "props": { "type": "object", "properties": { "order": { "type": "integer" } } } } } }
```
Every interface extends Base unless stated. `hasBlock` is only usable if the interface declares `blockTypes`.

### 4.2 Content
```json
[
 { "name": "Creature", "requires": ["Name"], "allows": ["Effects", "Owner", "DisplayProfile"],
   "blockTypes": ["appearance", "personality", "lore", "fact", "secret", "readaloud", "tactics", "note"],
   "relations": { "carries": { "to": ["Item"], "props": { "type": "object", "properties": { "quantity": { "type": "integer", "minimum": 0 }, "section": { "enum": ["coins", "attuned", "worn", "carried", "stored", "deeds"] } } } },
                  "hasStatblock": { "to": ["Statblock"], "cardinality": "one" }, "memberOf": { "to": ["Faction"], "props": { "type": "object", "properties": { "role": { "type": "string" }, "reputation": { "type": "array", "items": { "type": "object" } } } } },
                  "relatedTo": { "to": ["Creature", "Faction", "Location"], "props": { "type": "object", "properties": { "type": { "type": "string" } } } },
                  "companionOf": { "to": ["Creature"] }, "portrait": { "to": ["Asset"], "cardinality": "one" } } },
 { "name": "PC", "extends": ["Creature"], "requires": ["Owner"], "blockTypes": ["+poem", "+song"],
   "relations": { "hasClass": { "to": ["Class"], "props": { "type": "object", "properties": { "level": { "type": "integer" } } } }, "hasSpecies": { "to": ["Species"], "cardinality": "one" }, "hasBackground": { "to": ["Background"], "cardinality": "one" }, "grant": { "to": ["EditGrant"], "owned": true } } },
 { "name": "NPC", "extends": ["Creature"] },
 { "name": "Item", "requires": ["Name"], "allows": ["Rarity", "Effects"], "blockTypes": ["lore", "secret", "fact", "note"],
   "relations": { "rules": { "to": ["RuleElement"] }, "icon": { "to": ["Asset"], "cardinality": "one" } } },
 { "name": "Location", "requires": ["Name"], "allows": ["Coordinates"], "blockTypes": ["paragraph", "lore", "readaloud", "secret", "note", "poem", "song", "review"],
   "relations": { "contains": { "to": ["Location"], "owned": true, "props": { "type": "object", "properties": { "order": { "type": "integer" } } } }, "hasMap": { "to": ["Map"] }, "describedBy": { "to": ["LoreArticle"] } } },
 { "name": "Faction", "requires": ["Name"], "blockTypes": ["paragraph", "lore", "secret", "note"], "relations": { "describedBy": { "to": ["LoreArticle"] } } },
 { "name": "LoreArticle", "requires": ["Name"], "blockTypes": ["paragraph", "lore", "secret", "note", "poem", "song"] },
 { "name": "ContentBlock", "requires": ["Block"], "allows": ["KnowledgeRequirement", "TemporalValidity", "Owner"], "relations": { "requires": { "to": ["Tag"] } } },
 { "name": "Readaloud", "extends": ["ContentBlock"] },
 { "name": "Event", "requires": ["Name", "WorldDate"], "allows": ["KnowledgeRequirement"], "blockTypes": ["paragraph", "lore"] },
 { "name": "Tag", "requires": ["Name"] },
 { "name": "Term", "requires": ["TermInfo"], "relations": { "aliasOf": { "to": ["*"], "cardinality": "one" } } },
 { "name": "Asset", "requires": ["AssetInfo"], "allows": ["Name"] }
]
```

### 4.3 Rules
```json
[
 { "name": "Statblock", "requires": ["Statblock"], "allows": ["Name", "Effects", "DisplayProfile"], "blockTypes": ["tactics", "note"],
   "relations": { "composedOf": { "to": ["RuleElement"] }, "knows": { "to": ["Spell"] } } },
 { "name": "RuleElement", "requires": ["Name", "RuleInfo"], "allows": ["Effects"], "blockTypes": ["paragraph", "note"], "relations": { "variantOf": { "to": ["RuleElement"], "cardinality": "one" } } },
 { "name": "Spell", "requires": ["Name", "SpellInfo"], "blockTypes": ["paragraph", "note"], "relations": { "rules": { "to": ["RuleElement"] } } },
 { "name": "Class", "requires": ["Name", "Progression"], "blockTypes": ["paragraph"], "relations": { "grants": { "to": ["RuleElement"], "props": { "type": "object", "properties": { "atLevel": { "type": "integer" } } } }, "subclassOf": { "to": ["Class"], "cardinality": "one" } } },
 { "name": "Species", "requires": ["Name"], "blockTypes": ["paragraph"], "relations": { "grants": { "to": ["RuleElement"] } } },
 { "name": "Background", "requires": ["Name"], "blockTypes": ["paragraph"], "relations": { "grants": { "to": ["RuleElement"] } } },
 { "name": "Bookmark", "requires": ["Owner"], "relations": { "pins": { "to": ["RuleElement", "Spell"], "cardinality": "one" } } }
]
```

### 4.4 Narrative
```json
[
 { "name": "NarrativeContainer", "requires": ["Name", "ContainerType"], "allows": ["WorldDate", "Timestamp"], "blockTypes": ["paragraph", "readaloud", "note", "secret"],
   "relations": { "contains": { "to": ["NarrativeContainer"], "owned": true, "props": { "type": "object", "properties": { "order": { "type": "integer" } } } }, "log": { "to": ["SessionLog"], "owned": true, "cardinality": "one" }, "state": { "to": ["SessionState"], "owned": true } } },
 { "name": "Campaign", "extends": ["NarrativeContainer", "Layer"],
   "relations": { "settings": { "to": ["CampaignSettings"], "owned": true, "cardinality": "one" }, "knowledge": { "to": ["KnowledgeState"], "owned": true, "cardinality": "one" }, "party": { "to": ["Party"], "owned": true }, "inWorld": { "to": ["World"], "cardinality": "one" }, "activates": { "to": ["Layer"], "props": { "type": "object", "properties": { "priority": { "type": "integer" } } } }, "member": { "to": ["Membership"], "owned": true } } },
 { "name": "CampaignSettings", "requires": ["Settings"] },
 { "name": "KnowledgeState", "requires": [], "relations": { "holds": { "to": ["Tag"], "props": { "type": "object", "properties": { "holderId": { "type": "string" }, "since": { "type": "string", "format": "date-time" } } } } } },
 { "name": "Party", "requires": ["Name"], "blockTypes": ["note"], "relations": { "contains": { "to": ["PC"] } } },
 { "name": "Quest", "requires": ["Name"], "allows": ["Owner"], "blockTypes": ["paragraph", "note"], "relations": { "involves": { "to": ["Creature"], "props": { "type": "object", "properties": { "role": { "type": "string" } } } }, "attachedTo": { "to": ["NarrativeContainer"] } } },
 { "name": "Note", "requires": ["Description"], "allows": ["Owner"], "relations": { "attachedTo": { "to": ["NarrativeContainer"] }, "grant": { "to": ["EditGrant"], "owned": true } } },
 { "name": "Layer", "requires": ["Name", "LayerInfo"], "relations": { "dependsOn": { "to": ["Layer"], "props": { "type": "object", "properties": { "priority": { "type": "integer" } } } }, "defines": { "to": ["Tag"], "owned": true } } },
 { "name": "World", "extends": ["Layer"], "relations": { "calendar": { "to": ["CalendarSystem"], "owned": true }, "member": { "to": ["Membership"], "owned": true } } },
 { "name": "CalendarSystem", "requires": ["Name", "CalendarSpec"] },
 { "name": "ChangeEntry", "requires": ["ChangeInfo"] }
]
```

### 4.5 Play
```json
[
 { "name": "Encounter", "requires": ["Name"], "allows": ["EncounterInfo"], "blockTypes": ["tactics", "readaloud", "note"],
   "relations": { "uses": { "to": ["Creature"], "props": { "type": "object", "properties": { "count": { "type": "integer" } } } }, "loot": { "to": ["LootTable"] }, "map": { "to": ["Map"] }, "notes": { "to": ["Note"] }, "sound": { "to": ["Sound"] }, "attachedTo": { "to": ["NarrativeContainer"], "props": { "type": "object", "properties": { "order": { "type": "integer" }, "diceTable": { "type": "string" } } } } } },
 { "name": "LootTable", "requires": ["Name", "TableInfo"], "relations": { "yields": { "to": ["Item"], "props": { "type": "object", "properties": { "weight": { "type": "integer" }, "range": { "type": "string" } } } } } },
 { "name": "Map", "requires": ["Name", "GridConfig"], "relations": { "image": { "to": ["Asset"], "cardinality": "one" }, "childOf": { "to": ["Map"], "cardinality": "one", "props": { "type": "object", "properties": { "region": { "type": "object" }, "threshold": { "type": "number" } } } }, "token": { "to": ["Token"], "owned": true }, "for": { "to": ["Location"], "cardinality": "one" } } },
 { "name": "Token", "requires": ["TokenInfo", "Coordinates"], "relations": { "represents": { "to": ["Creature", "Location", "Quest"], "cardinality": "one" }, "image": { "to": ["Asset"], "cardinality": "one" } } },
 { "name": "Sound", "requires": ["Name"], "relations": { "file": { "to": ["Asset"], "cardinality": "one" }, "attachedTo": { "to": ["NarrativeContainer"] } } },
 { "name": "Handout", "requires": ["Name"], "allows": ["KnowledgeRequirement"], "relations": { "file": { "to": ["Asset"], "cardinality": "one" }, "attachedTo": { "to": ["NarrativeContainer"] } } },
 { "name": "SessionState", "requires": ["StatePayload"], "relations": { "steward": { "to": ["User"], "props": { "type": "object", "properties": { "gmOverride": { "type": "boolean" } } } } } },
 { "name": "SessionLog", "requires": [], "relations": { "entry": { "to": ["StateEvent", "DiceRoll"], "owned": true } } },
 { "name": "StateEvent", "requires": ["LogEntry"] },
 { "name": "DiceRoll", "requires": ["RollResult", "Timestamp"] }
]
```

### 4.6 Access and views
```json
[
 { "name": "User", "requires": ["Name", "Credentials"], "relations": { "preferences": { "to": ["UserPreferences"], "owned": true, "cardinality": "one" }, "board": { "to": ["Board"], "owned": true }, "bookmark": { "to": ["Bookmark"], "owned": true } } },
 { "name": "Role", "requires": ["Name", "RoleInfo"] },
 { "name": "Membership", "requires": ["MembershipInfo"] },
 { "name": "EditGrant", "requires": ["GrantInfo"] },
 { "name": "UserPreferences", "requires": ["Settings"] },
 { "name": "Board", "requires": ["Name", "BoardInfo"], "allows": ["CanvasConfig", "DisplayProfile"], "relations": { "widget": { "to": ["Widget"], "owned": true, "props": { "type": "object", "properties": { "order": { "type": "integer" } } } } } },
 { "name": "Widget", "requires": ["WidgetInfo"], "allows": ["ViewConfig"], "relations": { "shows": { "to": ["*"] } } }
]
```

## 5. Global relations (`relation_def`)
```json
[
 { "name": "partOf", "from": ["*"], "to": ["Layer"], "props": { "type": "object", "required": ["mode"], "properties": { "mode": { "enum": ["adds", "overrides", "removes"] }, "addedAt": { "type": "string", "format": "date-time" }, "addedBy": { "type": "string", "format": "uuid" }, "pinned": { "type": "boolean", "default": false, "description": "exactly this peg, not its successors (D6)" } } } },
 { "name": "successorOf", "from": ["*"], "to": ["same"], "cardinality": "one" },
 { "name": "overrides", "from": ["*"], "to": ["same"], "cardinality": "one", "props": { "type": "object", "properties": { "inLayer": { "type": "string", "format": "uuid" } } } },
 { "name": "changed", "from": ["ChangeEntry"], "to": ["*"], "props": { "type": "object", "properties": { "previousEntryId": { "type": "string", "format": "uuid" } } } },
 { "name": "linksTo", "from": ["*"], "to": ["*"], "derived": true, "props": { "type": "object", "properties": { "matched": { "type": "string" }, "via": { "enum": ["name", "alias", "explicit"] } } } },
 { "name": "sourcedFrom", "from": ["*"], "to": ["Layer"] },
 { "name": "forkedFrom", "from": ["*"], "to": ["*"], "cardinality": "one", "description": "explicit copy across packs/worlds (D15); IDs stay opaque, provenance retained" }
]
```
Cardinality-one relations are enforced by Validation (no DB unique constraint on jsonb-typed edges).

## 6. Projections and events

### 6.1 Projection definitions (v1)
```json
[
 { "name": "CharacterSheet",  "reads": { "components": ["Name", "Statblock", "Effects", "Owner"], "relations": ["carries", "hasBlock", "hasClass", "hasSpecies", "hasBackground", "composedOf", "knows"] },
   "viewConfig": { "sectionLayout": { "appearance": "secondary", "personality": "secondary", "lore": "collapsed", "fact": "collapsed", "secret": "hidden", "tactics": "hidden", "note": "secondary", "poem": "collapsed", "song": "collapsed" }, "statblockProminence": "full" } },
 { "name": "Kreaturansicht",  "reads": { "components": ["Name", "Statblock", "Effects", "Visibility", "SourceRef"], "relations": ["hasBlock", "carries", "composedOf", "memberOf", "relatedTo", "portrait"] },
   "viewConfig": { "sectionLayout": { "tactics": "primary", "readaloud": "secondary", "lore": "secondary", "fact": "secondary", "secret": "secondary", "appearance": "secondary", "personality": "secondary", "note": "collapsed" }, "statblockProminence": "full" } },
 { "name": "CombatView",      "reads": { "components": ["Name", "Statblock", "Effects"], "relations": ["hasBlock", "composedOf", "portrait"] },
   "viewConfig": { "sectionLayout": { "tactics": "primary", "appearance": "collapsed", "lore": "hidden", "personality": "hidden", "secret": "hidden", "fact": "hidden" }, "statblockProminence": "full" } },
 { "name": "CreatureWiki",    "reads": { "components": ["Name", "Statblock"], "relations": ["hasBlock", "memberOf", "relatedTo", "portrait", "linksTo"] },
   "viewConfig": { "sectionLayout": { "lore": "primary", "appearance": "primary", "personality": "primary", "fact": "secondary", "readaloud": "collapsed", "tactics": "hidden", "secret": "hidden" }, "statblockProminence": "compact" } },
 { "name": "SessionPrep",     "reads": { "components": ["Name", "ContainerType", "WorldDate", "Status"], "relations": ["contains", "hasBlock", "attachedTo"] },
   "viewConfig": { "statusFilter": ["planned", "used"], "sectionLayout": { "readaloud": "primary", "tactics": "primary", "secret": "secondary", "note": "secondary" } } },
 { "name": "IdeaInbox",       "reads": { "components": ["Name", "Status", "Owner"], "relations": ["attachedTo"] }, "viewConfig": { "statusFilter": ["idea"] } },
 { "name": "WikiArticle",     "reads": { "components": ["Name", "Description"], "relations": ["hasBlock", "contains", "describedBy", "linksTo"] },
   "viewConfig": { "mode": "raw", "sectionLayout": { "paragraph": "primary", "lore": "primary", "secret": "secondary", "poem": "secondary", "song": "secondary", "review": "secondary" } } },
 { "name": "EncounterRunner", "reads": { "components": ["Name", "EncounterInfo"], "relations": ["uses", "loot", "map", "notes", "sound", "hasBlock"] }, "viewConfig": { "sectionLayout": { "tactics": "primary", "readaloud": "primary" } } },
 { "name": "ScopeInspector",  "reads": { "components": ["Name", "Identity", "LayerInfo"], "relations": ["partOf", "dependsOn", "overrides", "successorOf"] }, "viewConfig": {} }
]
```

### 6.2 Event payloads (v1)
```json
[
 { "$id": "event/entity.written",    "type": "object", "required": ["entityId", "actor", "components"], "properties": { "entityId": { "$ref": "value/Ref" }, "actor": { "$ref": "value/Ref" }, "components": { "type": "array", "items": { "type": "string" } }, "relations": { "type": "array", "items": { "type": "string" } }, "layerId": { "$ref": "value/Ref" } } },
 { "$id": "event/status.changed",    "type": "object", "required": ["entityId", "from", "to", "actor"], "properties": { "entityId": { "$ref": "value/Ref" }, "from": { "type": ["string", "null"] }, "to": { "type": "string" }, "actor": { "$ref": "value/Ref" } } },
 { "$id": "event/knowledge.granted", "type": "object", "required": ["campaignId", "tagId", "holderId"], "properties": { "campaignId": { "$ref": "value/Ref" }, "tagId": { "$ref": "value/Ref" }, "holderId": { "$ref": "value/Ref" }, "cause": { "enum": ["gm", "session", "time"] } } },
 { "$id": "event/state.changed",     "type": "object", "required": ["sessionId", "kind", "version", "delta", "actor"], "properties": { "sessionId": { "$ref": "value/Ref" }, "kind": { "type": "string" }, "version": { "type": "integer" }, "delta": { "type": "object" }, "actor": { "$ref": "value/Ref" } } }
]
```

## 7. Decisions

| # | Question | Proposed default (in effect until decided) | Status |
|---|---|---|---|
| D0 | AD-01 persistence | three tables (A) → SQL views per interface when needed (C); Postgres; no Directus | **decided 2026-09-02** |
| D1 | core/dimension `kind` on components | dropped; `engine` alone (documentation only); "dimension" stays glossary shorthand | **decided 2026-09-02** |
| D2 | `allows` strict vs open | leading (hybrid): strict; `expertMode: true` per layer opens it; `universal: true` per component (Visibility, Status, notes) attachable regardless | open |
| D3 | key uniqueness | per layer (follows from D6) | **decided 2026-09-02** |
| D4 | statblock rule elements | Statblock is an **entity**: mechanics card on the statblock peg, `hasStatblock` from Creature, rule elements via `composedOf` | **decided 2026-09-02** |
| D5 | interface membership | asserted via `Typed`, verified by Validation | open |
| D6 | stack resolution rule | collect peg + successors; highest-priority Entry wins; tie in one layer → newest successor; `pinned: true` = exactly this peg (replaces `pinnedVersion`); direct placement replaces pin mechanics; no per-entity priority; bulk placement = UI op over Entries; override vs successor = user choice at write time | **decided 2026-09-02** |
| D7 | visibility inheritance | `inherit: true` on Visibility, evaluated by Resolution → REQ-156 | open |
| D8 | derived values | computed on read by Calculation; not stored | open |
| D9 | ownership cascade | API layer, driven by `owned: true` in the registry; no DB triggers | open |
| D10 | id and key conventions | UUID v7; key = `type/slug` lowercase | open |
| D11 | display as definition row | `renderer_def` analogous to `projection_def` (§1.4) | **decided 2026-09-04** |
| D12 | placements | in the board ViewConfig/CanvasConfig, not the layer system; boards may later become entities themselves | **decided 2026-09-04** |
| D13 | display resolution | entity proposes (DisplayProfile), board rules (typeRules), user overrides; placement override wins; tie → board rule | **decided 2026-09-04** |
| D14 | facets | system-wide open enum `value/Facet`; zoom depth maps onto facets | **decided 2026-09-04** |
| D15 | ID semantics | peg IDs opaque; provenance via metadata; copy only as explicit fork (`forkedFrom`) | **decided 2026-09-04** |
| D16 | placement kinds | a canvas placement is `entity` (peg ref) · `asset` (file ref) · `shape` (inline geometry/icon, no peg) · `widget` (interactive tool instance: creature creator, generators, …) | **decided 2026-09-05** |

## 8. Changelog
- **1.2** (2026-09-05): `media` on `meta/renderer` and decision D17 (print & export via facets).
- **1.1** (2026-09-05): Walkthrough outcomes merged: D1/D3/D4/D6 decided — Statblock as interface/entity (`hasStatblock`, `composedOf` moved to the statblock peg), Entry `pinned` flag, `forkedFrom` global relation. ViewConfig selection fields (three-level configuration). New: `meta/renderer` (D11), `value/Facet` (D14), `component/DisplayProfile` (D13), `component/CanvasConfig` with placement kinds entity/asset/shape/widget (D12/D16, REQ-157…166); Board allows CanvasConfig. Decisions table extended D11–D16.
- **1.0** (2026-09-02): First complete edition. All components from [[32_Data_Definitions]] v0.4 as schemas; 40 interfaces; six global relations; nine projection definitions; four v1 event payloads; decisions table D0–D10.
- **0.1** (2026-08-31): Review subset (superseded).
