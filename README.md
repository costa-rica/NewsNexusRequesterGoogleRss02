# NewsNexusRequesterGoogleRss02

## Overview

The News Data IO requester process is broken into two main parts:

### 1. Creating Prioritized Request Parameter Array

The app reads search parameter combinations from an Excel spreadsheet located at the path defined by the `PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED` environment variable. Each parameter object contains `andString`, `orString`, and `notString` fields.

These parameter objects are then prioritized using the following logic:

- Parameters that have **never been requested** before (i.e. no matching entry in the `NewsApiRequests` table) are placed **first**.
- Parameters that have been requested previously are then sorted in **ascending order of their `dateEndOfRequest`**, so older requests are retried first.

### 2. Making News API Requests

Once the prioritized array is constructed, the application:

- Iterates through the request parameter array.
- Makes a News API request for each item.
- Updates the `NewsApiRequests` table with the results, including the `dateEndOfRequest`, ensuring accurate tracking of each parameter's request history.

This methodical approach ensures comprehensive and prioritized coverage of query terms, avoiding redundant or excessive API usage.

## Requirements

This app requires importing or adding the `newsnexus07db` package, which provides the Sequelize setup and model definitions needed to read and write to the `NewsApiRequests` table.

## Environment Variables

```
APP_NAME=NewsNexusRequesterGoogleRss02
NAME_DB=newsnexus07.db
PATH_DATABASE=/Users/nick/Documents/_databases/NewsNexus07/
PATH_TO_API_RESPONSE_JSON_FILES=/Users/nick/Documents/_project_resources/NewsNexus07/api_response_json_files
PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED=/home/shared/project_resources/NewsNexus07/utilities/automation_excel_files/AutomatedRequestsNewsDataIo.xlsx
PATH_AND_FILENAME_TO_SEMANTIC_SCORER=/home/shared/applications/NewsNexusSemanticScorer02/index.js
PATH_TO_SEMANTIC_SCORER_DIR=/home/shared/project_resources/NewsNexus07/utilities/semantic_scorer
PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE=/home/shared/project_resources/NewsNexus07/utilities/semantic_scorer/NewsNexusSemanticScorerKeywords.xlsx
NAME_OF_ORG_REQUESTING_FROM="NewsData.IO"
ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES=true
LIMIT_DAYS_BACK_TO_REQUEST=29
LIMIT_MAXIMUM_MASTER_INDEX=10
MILISECONDS_IN_BETWEEN_REQUESTS=1100
```

## Excel spreadsheet

- columns needed: id, andString, orString, notString, startDate, includeDomains, excludeDomains
- no endDate column needed, this is calculated in the app
