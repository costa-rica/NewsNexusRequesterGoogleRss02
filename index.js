require("dotenv").config();

// Initialize Winston logger (must be first, before any logger.info calls)
const logger = require("./modules/logger");

logger.info("Starting NewsNexusRequesterGoogleRss02");

// Initialize database models BEFORE importing other modules
const { initModels, sequelize } = require("newsnexus10db");
initModels();
logger.info(
  `database location: ${process.env.PATH_DATABASE}${process.env.NAME_DB}`
);

const {
  getRequestsParameterArrayFromExcelFile,
} = require("./modules/utilitiesReadAndMakeFiles");
const {
  createArraysOfParametersNeverRequestedAndRequested,
  findEndDateToQueryParameters,
  runSemanticScorer,
} = require("./modules/utilitiesMisc");
const { requester } = require("./modules/requestsNewsGoogleRss");

logger.info(
  `--------------------------------------------------------------------------------`
);
logger.info(
  `- Start NewsNexusRequesterGoogleRss02 ${new Date().toISOString()} --`
);
logger.info(
  `MILISECONDS_IN_BETWEEN_REQUESTS: ${process.env.MILISECONDS_IN_BETWEEN_REQUESTS}`
);
logger.info(
  `--------------------------------------------------------------------------------`
);

async function main() {
  logger.info("Starting main function");
  // Step 1: Create Array of Parameters for Requests - prioritized based on dateEndOfRequest
  // Step 1.1: Get the query objects from Excel file
  const queryObjects = await getRequestsParameterArrayFromExcelFile();

  // Step 1.2: Create arrays of parameters never requested and requested
  const { arrayOfParametersNeverRequested, arrayOfParametersRequested } =
    await createArraysOfParametersNeverRequestedAndRequested(queryObjects);

  // Step 1.3: Sort the requested array in ascending order by dateEndOfRequest
  const arrayOfParametersRequestedSortedAscendingByDateEndOfRequest =
    arrayOfParametersRequested.sort((a, b) => {
      return new Date(a.dateEndOfRequest) - new Date(b.dateEndOfRequest);
    });

  // Step 1.4: Create the prioritized array
  const arrayOfPrioritizedParameters = [
    ...arrayOfParametersNeverRequested,
    ...arrayOfParametersRequestedSortedAscendingByDateEndOfRequest,
  ];

  logger.info(
    "- status: preparing paramters dateEndOfRequest this could take a while... updating for each row in Excel spreadsheet."
  );
  // Step 1.5: Add the endDate to each request from the existing NewsApiRequests table
  for (let i = 0; i < arrayOfPrioritizedParameters.length; i++) {
    arrayOfPrioritizedParameters[i].dateEndOfRequest =
      await findEndDateToQueryParameters(arrayOfPrioritizedParameters[i]);
    if (i % 1000 === 0) {
      logger.info(
        `-- ${i} of ${arrayOfPrioritizedParameters.length} rows processed --`
      );
    }
  }

  logger.info("- status: finished preparing paramters dateEndOfRequest");
  if (arrayOfPrioritizedParameters.length === 0) {
    logger.info(
      "--- No (unrequested) request parameters found in Excel file. Exiting process. ---"
    );
    return;
  }

  // Step 2: Process the requests
  let indexMaster = 0;
  let index = 0;

  // logger.info(arrayOfPrioritizedParameters);

  while (true) {
    // while (indexMaster < 2) {
    const currentParams = arrayOfPrioritizedParameters[index];
    if (!currentParams.dateEndOfRequest) {
      logger.info(
        `--- No dateEndOfRequest found for request index ${index} (indexMaster ${indexMaster}). Exiting process. ---`
      );
      break;
    }
    let dateEndOfRequest;

    logger.info(
      `-- ${indexMaster}: Start processing request for AND ${currentParams.andString} OR ${currentParams.orString} NOT ${currentParams.notString}`
    );
    // logger.info(`dateEndOfRequest: ${currentParams.dateEndOfRequest}`);

    // Step 2.1: Verify that dateEndOfRequest is today or prior
    if (
      new Date(currentParams?.dateEndOfRequest) <=
      new Date(new Date().toISOString().split("T")[0])
    ) {
      dateEndOfRequest = await requester(currentParams, indexMaster);
      // logger.info(`Doing some requesting 🛒 ...`);
      currentParams.dateEndOfRequest = dateEndOfRequest;
      logger.info(`dateEndOfRequest: ${currentParams.dateEndOfRequest}`);
    }
    // Step 2.2: Respect pacing
    await sleep(process.env.MILISECONDS_IN_BETWEEN_REQUESTS);

    logger.info(`End of ${index} request loop --`);
    index++;
    indexMaster++;
    const limit = Number(process.env.LIMIT_MAXIMUM_MASTER_INDEX) || 5;

    if (indexMaster === limit) {
      logger.info(`--- [End process] Went through ${limit} requests ---`);
      // await runSemanticScorer();
      break;
    }

    // Step 2.3: Check if all requests have been processed
    // Step 2.3.1: [End process] Check if all requests have been processed and dateEndOfRequest is today
    if (
      index === arrayOfPrioritizedParameters.length &&
      dateEndOfRequest === new Date().toISOString().split("T")[0]
    ) {
      logger.info(
        `--- [End process] All ${process.env.NAME_OF_ORG_REQUESTING_FROM} queries updated ---`
      );
      break;
    }

    // Step 2.3.2: [End process]Check if all requests have been processed
    if (index === arrayOfPrioritizedParameters.length) {
      logger.info(
        `--- [End process] Went through all ${arrayOfPrioritizedParameters.length} queries ---`
      );
      // index = 0;
      // await runSemanticScorer();
      break; // probably unnecessary
    }
  }
  logger.info("--- [End process] main and outside the while(true) loop ---");
  // // For Testing - use for ending process early wiht limit, otherwise this will already run based on other conditions
  runSemanticScorer();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
