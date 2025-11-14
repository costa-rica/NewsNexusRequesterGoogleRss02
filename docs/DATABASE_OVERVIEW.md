# Database Overview

This document provides a comprehensive overview of the NewsNexus10Db database schema. All tables use SQLite as the underlying database engine and are managed through Sequelize ORM.

## NewsNexus10Db Description

- One class per table (`src/models/<Name>.ts`) with strong typings.
- Centralized initialization and associations.
- Emit `.d.ts` so downstream apps (API, mobile) get type-safe imports.
- dist/ is the output directory for compiled JavaScript files.
- src/ is the source directory for TypeScript files.
- All tables have an updatedAt and createdAt field.

## Database / Project Architecture

### Project Structure

```
NewsNexus10Db/
├── src/                          # TypeScript source files
│   ├── index.ts                  # Main entry point
│   └── models/                   # Sequelize model definitions
│       ├── _connection.ts        # Database connection setup
│       ├── _index.ts            # Model registry and exports
│       ├── _associations.ts     # All model relationships
│       ├── Article.ts           # Core article model
│       ├── User.ts              # User management
│       └── [ other models...] # Complete model suite
├── dist/                        # Compiled JavaScript output
│   ├── index.js                 # Compiled entry point
│   ├── index.d.ts               # TypeScript declarations
│   └── models/                  # Compiled models with .d.ts files
├── docs/                        # Documentation
└── package.json                 # Project configuration
```

### Using This Package in Your Application

**IMPORTANT: Models must be initialized before use.**

When consuming this package in a microservice or application, you MUST call `initModels()` at the very start of your application, before importing any other modules that use the database models.

#### Initialization Pattern

```javascript
require("dotenv").config();

// Step 1: Initialize models FIRST, before any other imports
const { initModels, sequelize } = require("newsnexus10db");
initModels();

// Step 2: Now import other modules that use the models
const { myFunction } = require("./modules/myModule");
const { anotherFunction } = require("./modules/anotherModule");

// Step 3: (Optional) Sync database schema if tables don't exist
async function main() {
  await sequelize.sync(); // Creates tables if they don't exist

  // Your application logic here
}

main();
```

#### Why This Order Matters

- `initModels()` calls all model initialization functions (e.g., `initArticle()`, `initUser()`, etc.)
- It then calls `applyAssociations()` to set up all model relationships
- Models are unusable until this initialization completes
- If you try to use models before calling `initModels()`, you'll get errors like:
  - `TypeError: Cannot read properties of undefined (reading 'constructor')`
  - `TypeError: Cannot read properties of undefined (reading 'sequelize')`

#### Environment Variables

The package inherits environment variables from the consuming application. No `.env` file is needed in the package itself.

Required environment variables:

- `PATH_DATABASE`: Directory path for the database file (e.g., `/Users/nick/_databases/NewsNexus10/`)
- `NAME_DB`: Database filename (e.g., `newsnexus10.db`)

#### Creating Database Schema

If your database is new or missing tables, use `sequelize.sync()`:

```javascript
// Creates all tables based on model definitions
await sequelize.sync();

// Or with options:
await sequelize.sync({ alter: true }); // Updates existing tables to match models
await sequelize.sync({ force: true }); // WARNING: Drops all tables first
```

#### Using Models

After initialization, import and use models normally:

```javascript
const { Article, NewsApiRequest, User } = require("newsnexus10db");

// Query examples
const articles = await Article.findAll({ limit: 10 });
const request = await NewsApiRequest.findOne({ where: { id: 1 } });
```

## Template (copy for each new model)

```ts
// src/models/Example.ts
import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
} from "sequelize";
import { sequelize } from "./_connection";

export class Example extends Model<
  InferAttributes<Example>,
  InferCreationAttributes<Example>
> {
  declare id: CreationOptional<number>;
  declare name: string;

  // FK example:
  // declare userId: ForeignKey<User["id"]>;
  // declare user?: NonAttribute<User>;
}

export function initExample() {
  Example.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      // userId: { type: DataTypes.INTEGER, allowNull: false }
    },
    {
      sequelize,
      tableName: "examples",
      timestamps: true,
    }
  );
  return Example;
}
```

## Example src/models/\_index.ts

```ts
// SAMPLE of different proejctsrc/models/_index.ts
import { sequelize } from "./_connection";

import { initExample, Example } from "./Example";

import { applyAssociations } from "./_associations";

/** Initialize all models and associations once per process. */
export function initModels() {
  initExample();
  applyAssociations();

  return {
    sequelize,
    Example,
  };
}

// 👇 Export named items for consumers
export { sequelize, Example };

// 👇 Export named items for consumers
export { sequelize, Example };
```

### Database Configuration

- **Database Type**: SQLite (via Sequelize ORM)
- **Environment Variables**:
  - `PATH_DATABASE`: Directory path for database file
  - `NAME_DB`: Database filename
- **No .env file required**: Inherits environment from importing application

## Tables

### Articles

**Model:** `Article`

Main news article storage with metadata.

| Field                   | Type     | Constraints                 | Description                   |
| ----------------------- | -------- | --------------------------- | ----------------------------- |
| id                      | INTEGER  | PRIMARY KEY, AUTO_INCREMENT | Unique article identifier     |
| publicationName         | STRING   | NULLABLE                    | News source name              |
| author                  | STRING   | NULLABLE                    | Article author                |
| title                   | STRING   | NULLABLE                    | Article headline              |
| description             | STRING   | NULLABLE                    | Article summary               |
| url                     | STRING   | NULLABLE                    | Original article URL          |
| urlToImage              | STRING   | NULLABLE                    | Featured image URL            |
| publishedDate           | DATEONLY | NULLABLE                    | Publication date              |
| entityWhoFoundArticleId | INTEGER  | FK, NULLABLE                | Reference to discovery source |
| newsApiRequestId        | INTEGER  | FK, NULLABLE                | Reference to NewsAPI request  |
| newsRssRequestId        | INTEGER  | FK, NULLABLE                | Reference to RSS request      |
| createdAt               | DATE     | NOT NULL                    | Timestamp                     |
| updatedAt               | DATE     | NOT NULL                    | Timestamp                     |

### Users

**Model:** `User`

System users for approval/review workflows.

| Field     | Type    | Constraints                 | Description            |
| --------- | ------- | --------------------------- | ---------------------- |
| id        | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier |
| username  | STRING  | NOT NULL                    | User login name        |
| email     | STRING  | NOT NULL                    | User email address     |
| password  | STRING  | NOT NULL                    | Hashed password        |
| isAdmin   | BOOLEAN | DEFAULT false               | Admin privileges flag  |
| createdAt | DATE    | NOT NULL                    | Timestamp              |
| updatedAt | DATE    | NOT NULL                    | Timestamp              |

### States

**Model:** `State`

US geographic states for filtering.

| Field        | Type    | Constraints                 | Description             |
| ------------ | ------- | --------------------------- | ----------------------- |
| id           | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique state identifier |
| name         | STRING  | NOT NULL                    | Full state name         |
| abbreviation | STRING  | NOT NULL                    | Two-letter state code   |
| createdAt    | DATE    | NOT NULL                    | Timestamp               |
| updatedAt    | DATE    | NOT NULL                    | Timestamp               |

### Reports

**Model:** `Report`

Client report generation and tracking.

| Field                 | Type    | Constraints                 | Description              |
| --------------------- | ------- | --------------------------- | ------------------------ |
| id                    | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique report identifier |
| dateSubmittedToClient | DATE    | NULLABLE                    | Client submission date   |
| nameCrFormat          | STRING  | NULLABLE                    | CR format name           |
| nameZipFile           | STRING  | NULLABLE                    | Generated ZIP filename   |
| userId                | INTEGER | FK, NOT NULL                | User who created report  |
| createdAt             | DATE    | NOT NULL                    | Timestamp                |
| updatedAt             | DATE    | NOT NULL                    | Timestamp                |

### WebsiteDomains

**Model:** `WebsiteDomain`

Website domains for news source filtering.

| Field                 | Type    | Constraints                 | Description                |
| --------------------- | ------- | --------------------------- | -------------------------- |
| id                    | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique domain identifier   |
| name                  | STRING  | NOT NULL                    | Domain name                |
| isArchived            | BOOLEAN | DEFAULT false               | Archive status flag        |
| isArchievedNewsDataIo | BOOLEAN | DEFAULT false               | NewsData.io archive status |
| createdAt             | DATE    | NOT NULL                    | Timestamp                  |
| updatedAt             | DATE    | NOT NULL                    | Timestamp                  |

### NewsApiRequests

**Model:** `NewsApiRequest`

API request tracking for news aggregation services.

| Field                               | Type     | Constraints                 | Description                      |
| ----------------------------------- | -------- | --------------------------- | -------------------------------- |
| id                                  | INTEGER  | PRIMARY KEY, AUTO_INCREMENT | Unique request identifier        |
| newsArticleAggregatorSourceId       | INTEGER  | FK, NOT NULL                | Reference to aggregator source   |
| countOfArticlesReceivedFromRequest  | INTEGER  | NULLABLE                    | Articles received count          |
| countOfArticlesSavedToDbFromRequest | INTEGER  | NULLABLE                    | Articles saved to database count |
| countOfArticlesAvailableFromRequest | INTEGER  | NULLABLE                    | Articles available count         |
| dateStartOfRequest                  | DATEONLY | NULLABLE                    | Request start date               |
| dateEndOfRequest                    | DATEONLY | NULLABLE                    | Request end date                 |
| status                              | STRING   | NULLABLE                    | Request status                   |
| url                                 | STRING   | NULLABLE                    | API request URL                  |
| andString                           | STRING   | NULLABLE                    | AND search parameters            |
| orString                            | STRING   | NULLABLE                    | OR search parameters             |
| notString                           | STRING   | NULLABLE                    | NOT search parameters            |
| isFromAutomation                    | BOOLEAN  | DEFAULT false               | Automated request flag           |
| createdAt                           | DATE     | NOT NULL                    | Timestamp                        |
| updatedAt                           | DATE     | NOT NULL                    | Timestamp                        |

### ArticleContents

**Model:** `ArticleContent`

Full text content storage for articles with web scraping status tracking.

| Field                 | Type    | Constraints                 | Description                                                                |
| --------------------- | ------- | --------------------------- | -------------------------------------------------------------------------- |
| id                    | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique content identifier                                                  |
| articleId             | INTEGER | FK, NOT NULL                | Reference to article                                                       |
| content               | STRING  | NOT NULL                    | Full article content                                                       |
| scrapeStatusCheerio   | BOOLEAN | NULLABLE, DEFAULT NULL      | Cheerio scraping status (null=not attempted, true=success, false=failed)   |
| scrapeStatusPuppeteer | BOOLEAN | NULLABLE, DEFAULT NULL      | Puppeteer scraping status (null=not attempted, true=success, false=failed) |
| createdAt             | DATE    | NOT NULL                    | Timestamp                                                                  |
| updatedAt             | DATE    | NOT NULL                    | Timestamp                                                                  |

### ArticleApproveds

**Model:** `ArticleApproved`

Article approval workflow tracking.

| Field                       | Type     | Constraints                 | Description                 |
| --------------------------- | -------- | --------------------------- | --------------------------- |
| id                          | INTEGER  | PRIMARY KEY, AUTO_INCREMENT | Unique approval identifier  |
| userId                      | INTEGER  | FK, NOT NULL                | User who approved           |
| articleId                   | INTEGER  | FK, NOT NULL                | Reference to article        |
| isApproved                  | BOOLEAN  | DEFAULT true                | Approval status             |
| headlineForPdfReport        | STRING   | NULLABLE                    | PDF report headline         |
| publicationNameForPdfReport | STRING   | NULLABLE                    | PDF report publication name |
| publicationDateForPdfReport | DATEONLY | NULLABLE                    | PDF report publication date |
| textForPdfReport            | STRING   | NULLABLE                    | PDF report text content     |
| urlForPdfReport             | STRING   | NULLABLE                    | PDF report URL              |
| kmNotes                     | STRING   | NULLABLE                    | Knowledge manager notes     |
| createdAt                   | DATE     | NOT NULL                    | Timestamp                   |
| updatedAt                   | DATE     | NOT NULL                    | Timestamp                   |

### ArticlesApproved02

**Model:** `ArticlesApproved02`

Parallel article approval workflow tracking for AI-driven services. Mirrors ArticleApproved functionality but uses AI systems instead of human users for approval decisions.

| Field                       | Type     | Constraints                 | Description                 |
| --------------------------- | -------- | --------------------------- | --------------------------- |
| id                          | INTEGER  | PRIMARY KEY, AUTO_INCREMENT | Unique approval identifier  |
| artificialIntelligenceId    | INTEGER  | FK, NOT NULL                | AI system that approved     |
| articleId                   | INTEGER  | FK, NOT NULL                | Reference to article        |
| isApproved                  | BOOLEAN  | DEFAULT true                | Approval status             |
| headlineForPdfReport        | STRING   | NULLABLE                    | PDF report headline         |
| publicationNameForPdfReport | STRING   | NULLABLE                    | PDF report publication name |
| publicationDateForPdfReport | DATEONLY | NULLABLE                    | PDF report publication date |
| textForPdfReport            | STRING   | NULLABLE                    | PDF report text content     |
| urlForPdfReport             | STRING   | NULLABLE                    | PDF report URL              |
| kmNotes                     | STRING   | NULLABLE                    | Knowledge manager notes     |
| createdAt                   | DATE     | NOT NULL                    | Timestamp                   |
| updatedAt                   | DATE     | NOT NULL                    | Timestamp                   |

### ArticleDuplicateAnalyses

**Model:** `ArticleDuplicateAnalysis`

Tracks deduplication comparison outputs between a newly ingested article and an already approved article.

| Field                | Type    | Constraints                 | Description                                          |
| -------------------- | ------- | --------------------------- | ---------------------------------------------------- |
| id                   | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique analysis identifier                           |
| articleIdNew         | INTEGER | FK, NOT NULL                | ID of the newly ingested article                     |
| articleIdApproved    | INTEGER | FK, NOT NULL                | ID of the previously approved article                |
| reportId             | INTEGER | FK, NULLABLE                | Reference to report                                  |
| sameArticleIdFlag    | INTEGER | NOT NULL                    | 1 if IDs match; 0 otherwise                          |
| articleNewState      | STRING  | NOT NULL                    | State associated with the new article                |
| articleApprovedState | STRING  | NOT NULL                    | State associated with the approved article           |
| sameStateFlag        | INTEGER | NOT NULL                    | 1 if states match; 0 otherwise                       |
| urlCheck             | INTEGER | NOT NULL                    | URL match check result (e.g., 1 match / 0 no match)  |
| contentHash          | FLOAT   | NOT NULL                    | Hash comparison result indicator for article content |
| embeddingSearch      | FLOAT   | NOT NULL                    | Embedding similarity result indicator                |
| createdAt            | DATE    | NOT NULL                    | Timestamp                                            |
| updatedAt            | DATE    | NOT NULL                    | Timestamp                                            |

### ArticleRevieweds

**Model:** `ArticleReviewed`

Article review workflow tracking.

| Field      | Type    | Constraints                 | Description              |
| ---------- | ------- | --------------------------- | ------------------------ |
| id         | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique review identifier |
| userId     | INTEGER | FK, NOT NULL                | User who reviewed        |
| articleId  | INTEGER | FK, NOT NULL                | Reference to article     |
| isReviewed | BOOLEAN | DEFAULT true                | Review status            |
| kmNotes    | STRING  | NULLABLE                    | Knowledge manager notes  |
| createdAt  | DATE    | NOT NULL                    | Timestamp                |
| updatedAt  | DATE    | NOT NULL                    | Timestamp                |

### ArticleIsRelevants

**Model:** `ArticleIsRelevant`

Article relevance assessment tracking.

| Field      | Type    | Constraints                 | Description                 |
| ---------- | ------- | --------------------------- | --------------------------- |
| id         | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique relevance identifier |
| userId     | INTEGER | FK, NOT NULL                | User who assessed           |
| articleId  | INTEGER | FK, NOT NULL                | Reference to article        |
| isRelevant | BOOLEAN | DEFAULT true                | Relevance status            |
| kmNotes    | STRING  | NULLABLE                    | Knowledge manager notes     |
| createdAt  | DATE    | NOT NULL                    | Timestamp                   |
| updatedAt  | DATE    | NOT NULL                    | Timestamp                   |

### EntityWhoFoundArticles

**Model:** `EntityWhoFoundArticle`

Tracking entities that discover articles.

| Field                         | Type    | Constraints                 | Description                  |
| ----------------------------- | ------- | --------------------------- | ---------------------------- |
| id                            | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique entity identifier     |
| userId                        | INTEGER | FK, NULLABLE                | User who found article       |
| newsArticleAggregatorSourceId | INTEGER | FK, NULLABLE                | Aggregator source that found |
| createdAt                     | DATE    | NOT NULL                    | Timestamp                    |
| updatedAt                     | DATE    | NOT NULL                    | Timestamp                    |

### EntityWhoCategorizedArticles

**Model:** `EntityWhoCategorizedArticle`

Tracking entities that categorize articles.

| Field                    | Type    | Constraints                 | Description                |
| ------------------------ | ------- | --------------------------- | -------------------------- |
| id                       | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique entity identifier   |
| userId                   | INTEGER | FK, NULLABLE                | User who categorized       |
| artificialIntelligenceId | INTEGER | FK, NULLABLE                | AI system that categorized |
| createdAt                | DATE    | NOT NULL                    | Timestamp                  |
| updatedAt                | DATE    | NOT NULL                    | Timestamp                  |

### ArtificialIntelligences

**Model:** `ArtificialIntelligence`

AI models and systems configuration.

| Field                | Type    | Constraints                 | Description                 |
| -------------------- | ------- | --------------------------- | --------------------------- |
| id                   | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique AI system identifier |
| name                 | STRING  | NOT NULL                    | AI system name              |
| description          | STRING  | NULLABLE                    | AI system description       |
| huggingFaceModelName | STRING  | NULLABLE                    | HuggingFace model name      |
| huggingFaceModelType | STRING  | NULLABLE                    | HuggingFace model type      |
| createdAt            | DATE    | NOT NULL                    | Timestamp                   |
| updatedAt            | DATE    | NOT NULL                    | Timestamp                   |

### NewsArticleAggregatorSources

**Model:** `NewsArticleAggregatorSource`

News source and aggregator configuration.

| Field     | Type    | Constraints                 | Description              |
| --------- | ------- | --------------------------- | ------------------------ |
| id        | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique source identifier |
| nameOfOrg | STRING  | NULLABLE                    | Organization name        |
| url       | STRING  | NULLABLE                    | Source URL               |
| apiKey    | STRING  | NULLABLE                    | API access key           |
| isApi     | BOOLEAN | DEFAULT false               | API source flag          |
| isRss     | BOOLEAN | DEFAULT false               | RSS source flag          |
| createdAt | DATE    | NOT NULL                    | Timestamp                |
| updatedAt | DATE    | NOT NULL                    | Timestamp                |

### Contract/Junction Tables

### ArticleStateContracts

**Model:** `ArticleStateContract`

Many-to-many relationship between Articles and States.

| Field     | Type    | Constraints                 | Description          |
| --------- | ------- | --------------------------- | -------------------- |
| id        | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique contract ID   |
| articleId | INTEGER | FK, NOT NULL                | Reference to article |
| stateId   | INTEGER | FK, NOT NULL                | Reference to state   |
| createdAt | DATE    | NOT NULL                    | Timestamp            |
| updatedAt | DATE    | NOT NULL                    | Timestamp            |

### ArticleReportContracts

**Model:** `ArticleReportContract`

Many-to-many relationship between Articles and Reports.

| Field                          | Type    | Constraints                 | Description                |
| ------------------------------ | ------- | --------------------------- | -------------------------- |
| id                             | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique contract ID         |
| reportId                       | INTEGER | FK, NOT NULL                | Reference to report        |
| articleId                      | INTEGER | FK, NOT NULL                | Reference to article       |
| articleReferenceNumberInReport | STRING  | NULLABLE                    | Reference number in report |
| articleAcceptedByCpsc          | BOOLEAN | DEFAULT true                | CPSC acceptance status     |
| articleRejectionReason         | STRING  | NULLABLE                    | Reason for rejection       |
| createdAt                      | DATE    | NOT NULL                    | Timestamp                  |
| updatedAt                      | DATE    | NOT NULL                    | Timestamp                  |

### ArticleEntityWhoCategorizedArticleContracts

**Model:** `ArticleEntityWhoCategorizedArticleContract`

Links articles to categorization entities with keyword data.

| Field                  | Type    | Constraints                 | Description              |
| ---------------------- | ------- | --------------------------- | ------------------------ |
| id                     | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique contract ID       |
| articleId              | INTEGER | FK, NOT NULL                | Reference to article     |
| entityWhoCategorizesId | INTEGER | FK, NOT NULL                | Reference to categorizer |
| keyword                | STRING  | NULLABLE                    | Categorization keyword   |
| keywordRating          | FLOAT   | NULLABLE                    | Keyword relevance rating |
| createdAt              | DATE    | NOT NULL                    | Timestamp                |
| updatedAt              | DATE    | NOT NULL                    | Timestamp                |

_Note: Has unique index on (articleId, entityWhoCategorizesId, keyword)_

### ArticleEntityWhoCategorizedArticleContracts02

**Model:** `ArticleEntityWhoCategorizedArticleContracts02`

Links articles to categorization entities with flexible key-value storage.

| Field                  | Type    | Constraints                 | Description                     |
| ---------------------- | ------- | --------------------------- | ------------------------------- |
| id                     | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique contract ID              |
| articleId              | INTEGER | FK, NOT NULL                | Reference to article            |
| entityWhoCategorizesId | INTEGER | FK, NOT NULL                | Reference to categorizer        |
| key                    | STRING  | NULLABLE                    | Categorization key              |
| valueString            | STRING  | NULLABLE                    | String value for categorization |
| valueNumber            | FLOAT   | NULLABLE                    | Numeric value for metadata      |
| valueBoolean           | BOOLEAN | NULLABLE                    | Boolean flag for metadata       |
| createdAt              | DATE    | NOT NULL                    | Timestamp                       |
| updatedAt              | DATE    | NOT NULL                    | Timestamp                       |

_Note: Has unique index on (articleId, entityWhoCategorizesId, key)_

### NewsApiRequestWebsiteDomainContracts

**Model:** `NewsApiRequestWebsiteDomainContract`

Links NewsAPI requests to website domains for filtering.

| Field                         | Type    | Constraints                 | Description                 |
| ----------------------------- | ------- | --------------------------- | --------------------------- |
| id                            | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique contract ID          |
| newsApiRequestId              | INTEGER | FK, NULLABLE                | Reference to API request    |
| websiteDomainId               | INTEGER | FK, NULLABLE                | Reference to website domain |
| includedOrExcludedFromRequest | STRING  | DEFAULT "included"          | Include/exclude status      |
| createdAt                     | DATE    | NOT NULL                    | Timestamp                   |
| updatedAt                     | DATE    | NOT NULL                    | Timestamp                   |

## Database Relationships

The following relationships are defined in `src/models/_associations.ts` and establish the complete relational structure of the NewsNexus10Db database:

### Core Entity Relationships

#### User Relationships

- **User → EntityWhoCategorizedArticle** (1:Many): Users can categorize multiple articles
- **User → EntityWhoFoundArticle** (1:Many): Users can discover multiple articles
- **User → Report** (1:Many): Users can create multiple reports
- **User → ArticleReviewed** (1:Many): Users can review multiple articles
- **User → ArticleApproved** (1:Many): Users can approve multiple articles
- **User → ArticleIsRelevant** (1:Many): Users can assess relevance of multiple articles

#### Article Core Relationships

- **Article → ArticleStateContract** (1:Many): Articles can be associated with multiple states
- **Article → ArticleKeywordContract** (1:Many): Articles can have multiple keywords/categorizations
- **Article → ArticleEntityWhoCategorizedArticleContract** (1:Many): Articles can be categorized with keyword and rating data
- **Article → ArticleEntityWhoCategorizedArticleContracts02** (1:Many): Articles can be categorized with flexible key-value metadata
- **Article → ArticleContent** (1:Many): Articles can have multiple content versions
- **Article → ArticleReportContract** (1:Many): Articles can appear in multiple reports
- **Article → ArticleReviewed** (1:Many): Articles can have multiple review records
- **Article → ArticleApproved** (1:Many): Articles can have multiple approval records
- **Article → ArticlesApproved02** (1:Many): Articles can have multiple AI-driven approval records
- **Article → ArticleIsRelevant** (1:Many): Articles can have multiple relevance assessments

#### Article Discovery and Source Tracking

- **EntityWhoFoundArticle → Article** (1:Many): Discovery entities can find multiple articles
- **NewsApiRequest → Article** (1:Many): API requests can retrieve multiple articles
- **NewsRssRequest → Article** (1:Many): RSS requests can retrieve multiple articles

### News Source and Aggregation Relationships

#### NewsArticleAggregatorSource Relationships

- **NewsArticleAggregatorSource → EntityWhoFoundArticle** (1:1): Source can have one discovery entity
- **NewsArticleAggregatorSource → NewsApiRequest** (1:Many): Sources can make multiple API requests
- **NewsArticleAggregatorSource → NewsRssRequest** (1:Many): Sources can make multiple RSS requests
- **NewsArticleAggregatorSource → NewsArticleAggregatorSourceStateContract** (1:Many): Sources can be filtered by multiple states

### AI and Categorization Relationships

- **ArtificialIntelligence → EntityWhoCategorizedArticle** (1:Many): AI systems can categorize multiple articles
- **ArtificialIntelligence → ArticlesApproved02** (1:Many): AI systems can approve/reject multiple articles
- **EntityWhoCategorizedArticle → ArticleKeywordContract** (1:Many): Categorizers can assign multiple keywords
- **EntityWhoCategorizedArticle → ArticleEntityWhoCategorizedArticleContract** (1:Many): Categorizers can assign keyword and rating data
- **EntityWhoCategorizedArticle → ArticleEntityWhoCategorizedArticleContracts02** (1:Many): Categorizers can assign flexible key-value metadata

### Many-to-Many Relationships

#### Article ↔ State (through ArticleStateContract)

Articles can be associated with multiple states, and states can have multiple articles.

#### Article ↔ EntityWhoCategorizedArticle (through ArticleEntityWhoCategorizedArticleContract)

Articles can be categorized by multiple entities, and entities can categorize multiple articles. This relationship includes keyword and rating data.

#### Article ↔ EntityWhoCategorizedArticle (through ArticleEntityWhoCategorizedArticleContracts02)

Articles can be categorized by multiple entities with flexible key-value storage, and entities can categorize multiple articles. This relationship supports string, numeric, and boolean values for metadata storage.

#### NewsApiRequest ↔ WebsiteDomain (through NewsApiRequestWebsiteDomainContract)

API requests can filter multiple website domains, and domains can be used in multiple requests.

#### NewsArticleAggregatorSource ↔ State (through NewsArticleAggregatorSourceStateContract)

News sources can be filtered by multiple states, and states can filter multiple sources.

### Duplicate Analysis Relationships

- **Article → ArticleDuplicateAnalysis** (1:Many as "newArticle"): Articles can be the subject of multiple duplicate analyses
- **Article → ArticleDuplicateAnalysis** (1:Many as "approvedArticle"): Articles can be compared against in multiple duplicate analyses

### Contract/Junction Table Details

- **ArticleStateContract**: Links articles to US states with timestamps
- **ArticleReportContract**: Links articles to reports with reference numbers and CPSC acceptance status
- **ArticleEntityWhoCategorizedArticleContract**: Links articles to categorizers with keyword and rating data (unique index on articleId, entityWhoCategorizesId, keyword)
- **ArticleEntityWhoCategorizedArticleContracts02**: Links articles to categorizers with flexible key-value storage supporting string, numeric, and boolean values (unique index on articleId, entityWhoCategorizesId, key)
- **NewsApiRequestWebsiteDomainContract**: Links API requests to website domains with include/exclude status
- **NewsArticleAggregatorSourceStateContract**: Links news sources to states for geographic filtering
