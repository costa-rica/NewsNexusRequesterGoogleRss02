const {
  NewsApiRequest,
  NewsArticleAggregatorSource,
} = require("newsnexus07db");
const { exec } = require("child_process");

async function createArraysOfParametersNeverRequestedAndRequested(
  queryObjects
) {
  let arrayOfParametersNeverRequested = [];
  let arrayOfParametersRequested = [];
  const newsArticleAggregatorSourceObj =
    await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: process.env.NAME_OF_ORG_REQUESTING_FROM },
      raw: true, // Returns data without all the database gibberish
    });
  // Load all existing requests from DB (we only need these 3 fields)
  const existingRequests = await NewsApiRequest.findAll({
    where: {
      newsArticleAggregatorSourceId: newsArticleAggregatorSourceObj.id,
    },
    attributes: ["andString", "orString", "notString", "dateEndOfRequest"],
    raw: true,
    order: [["dateEndOfRequest", "DESC"]],
  });

  for (const queryObj of queryObjects) {
    // console.log(queryObj);
    const alreadyRequested = existingRequests.find((req) => {
      return (
        req.andString === queryObj.andString &&
        req.orString === queryObj.orString &&
        req.notString === queryObj.notString
      );
    });

    if (alreadyRequested) {
      arrayOfParametersRequested.push({
        ...queryObj,
        dateEndOfRequest: alreadyRequested.dateEndOfRequest,
      });
    } else {
      arrayOfParametersNeverRequested.push(queryObj);
    }
  }

  // -----> TODO: Remove any requests where dateEndOfRequest is equal to today
  arrayOfParametersRequested = arrayOfParametersRequested.filter((req) => {
    return req.dateEndOfRequest !== new Date().toISOString().split("T")[0];
  });

  return { arrayOfParametersNeverRequested, arrayOfParametersRequested };
}

async function checkRequestAndModifyDates(
  andString,
  orString,
  notString,
  startDate,
  endDate,
  // gNewsSourceObj,
  newsArticleAggregatorSourceObj,
  requestWindowInDays
) {
  const existingRequests = await NewsApiRequest.findAll({
    where: {
      andString: andString,
      orString: orString,
      notString: notString,
      newsArticleAggregatorSourceId: newsArticleAggregatorSourceObj.id,
    },
    order: [["dateEndOfRequest", "DESC"]],
    limit: 1,
  });

  if (existingRequests.length > 0) {
    const latestEndDate = existingRequests[0].dateEndOfRequest;
    const newStartDate = latestEndDate;
    let newEndDate = new Date(
      new Date(newStartDate).getTime() +
        requestWindowInDays * 24 * 60 * 60 * 1000
    );

    const today = new Date();
    if (newEndDate > today) {
      newEndDate = today;
    }

    newEndDate = newEndDate.toISOString().split("T")[0];

    return { adjustedStartDate: newStartDate, adjustedEndDate: newEndDate };
  } else {
    const today = new Date();
    const endDateDateObj = new Date(endDate);
    if (endDateDateObj > today) {
      endDate = today.toISOString().split("T")[0];
    }
    console.log(`----> received enddate: ${endDate}`);
    return { adjustedStartDate: startDate, adjustedEndDate: endDate };
  }
}

async function findEndDateToQueryParameters(queryParameters) {
  const newsArticleAggregatorSourceObj =
    await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: process.env.NAME_OF_ORG_REQUESTING_FROM },
      raw: true, // Returns data without all the database gibberish
    });
  const existingRequests = await NewsApiRequest.findAll({
    where: {
      andString: queryParameters.andString,
      orString: queryParameters.orString,
      notString: queryParameters.notString,
      newsArticleAggregatorSourceId: newsArticleAggregatorSourceObj.id,
    },
    order: [["dateEndOfRequest", "DESC"]],
    limit: 1,
  });

  if (existingRequests.length > 0) {
    const latestEndDate = existingRequests[0].dateEndOfRequest;
    return latestEndDate;
  } else {
    const day180daysAgo = new Date(
      new Date().setDate(new Date().getDate() - 180)
    )
      .toISOString()
      .split("T")[0];
    return day180daysAgo;
  }
}

async function runSemanticScorer() {
  console.log(
    `Starting child process: ${process.env.PATH_AND_FILENAME_TO_SEMANTIC_SCORER}`
  );
  return new Promise((resolve, reject) => {
    exec(
      `node "${process.env.PATH_AND_FILENAME_TO_SEMANTIC_SCORER}"`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing child process: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`Child process stderr: ${stderr}`);
        }
        console.log(`Child process finished`);
        resolve(stdout);
      }
    );
  })
    .then(() => {
      console.log(
        " [NewsNexusRequesterGoogleRss02] ✅ NewsNexusSemanticScorer02 has finished."
      );
      process.exit();
    })
    .catch(() => {
      console.log(
        " [NewsNexusRequesterGoogleRss02] ❌ NewsNexusSemanticScorer02 has finished with error."
      );
      process.exit(1);
    });
}

module.exports = {
  createArraysOfParametersNeverRequestedAndRequested,
  checkRequestAndModifyDates,
  findEndDateToQueryParameters,
  runSemanticScorer,
};
