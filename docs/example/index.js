require("dotenv").config();

// Initialize Winston logger
const logger = require("./modules/logger");

// Wrap everything in an async IIFE to allow early return from guardrail
(async () => {
  // Check for --run-anyway argument to bypass guardrail
  const runAnyway = process.argv.includes("--run-anyway");

  // Time check: Only run between 20:55 and 21:05 UTC (unless --run-anyway is passed)
  const targetTimeToStartAutomation = 21;
  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = (targetTimeToStartAutomation - 1) * 60 + 55; // 20:55 UTC
  const endMinutes = targetTimeToStartAutomation * 60 + 5; // 21:05 UTC

  if (!runAnyway && (currentMinutes < startMinutes || currentMinutes > endMinutes)) {
    const message = `Not within allowed time window (20:55–21:05 UTC), exiting. Current UTC time: ${now.toISOString()}`;
    logger.info(message);

    // Ensure log is written to file before exit (especially important in production mode)
    // Also write to stderr for immediate visibility
    console.error(message);

    // Give Winston time to flush logs to disk before exiting
    await new Promise((resolve) => setTimeout(resolve, 100));
    process.exit(0);
  }

  if (runAnyway) {
    logger.warn(
      `Guardrail bypassed with --run-anyway flag. Current UTC time: ${now.toISOString()}`
    );
  } else {
    logger.info(`Running ${process.env.NAME_APP} between 20:55 and 21:05 UTC`);
  }
  logger.info("Starting NewsNexusRequesterGNews02");

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
  const { requester } = require("./modules/requestsGNews");

  logger.info(
    `--------------------------------------------------------------------------------`
  );
  logger.info(`- Start ${process.env.NAME_APP} ${new Date().toISOString()} --`);
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

    if (arrayOfPrioritizedParameters.length === 0) {
      logger.info(
        "--- No (unrequested)request parameters found in Excel file. Exiting process. ---"
      );
      return;
    }

    // Step 2: Process the requests
    let indexMaster = 0;
    let index = 0;

    while (true) {
      const currentParams = arrayOfPrioritizedParameters[index];
      let dateEndOfRequest;

      logger.info(
        `-- ${index}: Start processing request for AND ${currentParams.andString} OR ${currentParams.orString} NOT ${currentParams.notString}`
      );
      // Step 2.1: Verify that dateEndOfRequest is today or prior
      if (
        new Date(currentParams?.dateEndOfRequest) <=
        new Date(new Date().toISOString().split("T")[0])
      ) {
        dateEndOfRequest = await requester(currentParams, indexMaster);
        currentParams.dateEndOfRequest = dateEndOfRequest;
      }
      // Step 2.2: Respect pacing
      await sleep(process.env.MILISECONDS_IN_BETWEEN_REQUESTS);
      logger.info(`End of ${index} request loop --`);
      index++;
      indexMaster++;
      if (
        indexMaster > Number(process.env.LIMIT_MASTER_INDEX_OF_WHILE_TRUE_LOOP)
      ) {
        logger.info(
          `--- End due to indexMaster > ${process.env.LIMIT_MASTER_INDEX_OF_WHILE_TRUE_LOOP} ---`
        );
        await runSemanticScorer();
        break;
      }

      // Step 2.3: Check if all requests have been processed
      // Step 2.3.1: [End process] Check if all requests have been processed and dateEndOfRequest is today
      if (
        index === arrayOfPrioritizedParameters.length &&
        dateEndOfRequest === new Date().toISOString().split("T")[0]
      ) {
        logger.info(`--- [End process] All GNews queries updated ---`);
        await runSemanticScorer();
        break;
      }

      // Step 2.3.2: [Restart looping]Check if all requests have been processed and dateEndOfRequest is not today
      if (index === arrayOfPrioritizedParameters.length) {
        logger.info(
          `--- [Restart looping] Went through all ${arrayOfPrioritizedParameters.length} queries and dateEndOfRequest is not today ---`
        );
        index = 0;
      }
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  await main();
})();
