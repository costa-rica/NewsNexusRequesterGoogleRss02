require("dotenv").config();

// Initialize Winston logger
const logger = require("./modules/logger");

// Wrap everything in an async IIFE to allow early return from guardrail
(async () => {
  // Check for --run-anyway argument to bypass guardrail
  const runAnyway = process.argv.includes("--run-anyway");

  // Parse guardrail configuration from environment variables
  const guardrailTargetTime = process.env.GUARDRAIL_TARGET_TIME || "23:00";
  const guardrailWindowMins = parseInt(process.env.GUARDRAIL_TARGET_WINDOW_IN_MINS) || 5;

  // Validate and parse the target time (HH:MM format)
  const timeMatch = guardrailTargetTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    logger.error(`Invalid GUARDRAIL_TARGET_TIME format: "${guardrailTargetTime}". Expected HH:MM format.`);
    process.exit(1);
  }

  const targetHour = parseInt(timeMatch[1]);
  const targetMinute = parseInt(timeMatch[2]);

  if (targetHour < 0 || targetHour > 23 || targetMinute < 0 || targetMinute > 59) {
    logger.error(`Invalid GUARDRAIL_TARGET_TIME: "${guardrailTargetTime}". Hour must be 0-23, minute must be 0-59.`);
    process.exit(1);
  }

  // Calculate the time window in minutes from midnight
  const targetMinutes = targetHour * 60 + targetMinute;
  const startMinutes = targetMinutes - guardrailWindowMins;
  const endMinutes = targetMinutes + guardrailWindowMins;

  // Get current time
  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Format times for logging (HH:MM)
  const formatTime = (mins) => {
    // Handle negative minutes (wraps to previous day)
    const normalizedMins = ((mins % 1440) + 1440) % 1440; // 1440 = 24 * 60
    const h = Math.floor(normalizedMins / 60);
    const m = normalizedMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const startTimeStr = formatTime(startMinutes);
  const endTimeStr = formatTime(endMinutes);

  // Time check: Only run within the configured window (unless --run-anyway is passed)
  if (!runAnyway && (currentMinutes < startMinutes || currentMinutes > endMinutes)) {
    const message = `Not within allowed time window (${startTimeStr}–${endTimeStr} UTC), exiting. Current UTC time: ${now.toISOString()}`;
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
    logger.info(`Running ${process.env.NAME_APP} within time window ${startTimeStr}–${endTimeStr} UTC`);
  }
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

  await main();
})();
