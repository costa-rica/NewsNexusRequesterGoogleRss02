const {
  Article,
  NewsApiRequest,
  EntityWhoFoundArticle,
  NewsArticleAggregatorSource,
  WebsiteDomain,
  NewsApiRequestWebsiteDomainContract,
  ArticleContent,
} = require("newsnexus07db");
const {
  writeResponseDataFromNewsAggregator,
} = require("./utilitiesReadAndMakeFiles");
const {
  checkRequestAndModifyDates,
  runSemanticScorer,
} = require("./utilitiesMisc");
// const xml2js = require("xml2js");
const { parseStringPromise } = require("xml2js");

async function requester(currentParams, indexMaster) {
  // Step 1: prepare paramters
  const requestWindowInDays = 10; // how many days from startDate to endDate
  const andString = currentParams.andString;
  const orString = currentParams.orString;
  const notString = currentParams.notString;
  const dateStartOfRequest = currentParams.dateStartOfRequest;
  const includeDomainsArrayString = currentParams.includeDomainsArrayString;
  const excludeDomainsArrayString = currentParams.excludeDomainsArrayString;

  const dateEndOfRequest = new Date(
    new Date().setDate(
      new Date(dateStartOfRequest).getDate() + requestWindowInDays
    )
  )
    .toISOString()
    .split("T")[0];

  const newsArticleAggregatorSourceObj =
    await NewsArticleAggregatorSource.findOne({
      where: { nameOfOrg: process.env.NAME_OF_ORG_REQUESTING_FROM },
      raw: true, // Returns data without all the database gibberish
    });

  // // Step 2: Check include and exclude domain string and convert to object arrays
  // const includeDomainsArray = includeDomainsArrayString
  //   .split(",")
  //   .map((domain) => domain.trim());
  // const excludeDomainsArray = excludeDomainsArrayString
  //   .split(",")
  //   .map((domain) => domain.trim());
  // let excludeDomainsObjArray = [];
  // let includeDomainsObjArray = [];

  // console.log(
  //   `includeDomainsArray [requester] (${includeDomainsArray.length}): ${includeDomainsArray}`
  // );
  // console.log(
  //   `excludeDomainsArray [requester] (${excludeDomainsArray.length}): ${excludeDomainsArray}`
  // );

  // if (includeDomainsArray.length > 0) {
  //   for (const domain of includeDomainsArray) {
  //     const domainObj = await WebsiteDomain.findOne({
  //       where: { name: domain },
  //       raw: true,
  //     });
  //     if (domainObj) {
  //       includeDomainsObjArray.push(domainObj);
  //     }
  //   }
  // }
  // if (excludeDomainsArray.length > 0) {
  //   for (const domain of excludeDomainsArray) {
  //     const domainObj = await WebsiteDomain.findOne({
  //       where: { name: domain },
  //       raw: true,
  //     });
  //     if (domainObj) {
  //       excludeDomainsObjArray.push(domainObj);
  //     }
  //   }
  // }

  // Step 2: Modify the startDate and endDate if necessary
  const { adjustedStartDate, adjustedEndDate } =
    await checkRequestAndModifyDates(
      andString,
      orString,
      notString,
      dateStartOfRequest,
      dateEndOfRequest,
      newsArticleAggregatorSourceObj,
      requestWindowInDays
    );

  // Step 3: make the request
  let requestResponseData = null;
  let newsApiRequestObj = null;

  if (adjustedStartDate === adjustedEndDate) {
    console.log(`No request needed for ${requestParametersObject.andString}`);
    return adjustedEndDate;
  }

  try {
    ({ requestResponseData, newsApiRequestObj } = await makeGoogleRssRequest(
      newsArticleAggregatorSourceObj,
      andString,
      orString,
      notString,
      indexMaster
    ));
  } catch (error) {
    console.error(
      `Error during ${process.env.NAME_OF_ORG_REQUESTING_FROM} API request:`,
      error
    );
    return; // prevent proceeding to storeGNewsArticles if request failed
  }

  // console.log(
  //   "-----> [in requester after makeNewsApiRequestDetailed] newsApiRequestObj ",
  //   newsApiRequestObj
  // );
  // Step 4: store the articles
  if (!requestResponseData?.results) {
    console.log(
      `No articles received from ${process.env.NAME_OF_ORG_REQUESTING_FROM} request response`
    );
  } else {
    console.log(`newApiRequestObj: ${newsApiRequestObj.nameOfOrg}`);

    // Store articles and update NewsApiRequest
    await storeNewsApiArticles(requestResponseData, newsApiRequestObj);
    console.log(`completed NewsApiRequest.id: ${newsApiRequestObj.id}`);
  }

  // return "2025-05-03";
  return adjustedEndDate;
}

// Make a single requuest to the Google RSS
async function makeGoogleRssRequest(
  source,
  keywordsAnd,
  keywordsOr,
  keywordsNot,
  indexMaster
) {
  function splitPreservingQuotes(str) {
    return str.match(/"[^"]+"|\S+/g)?.map((s) => s.trim()) || [];
  }

  const andArray = splitPreservingQuotes(keywordsAnd ? keywordsAnd : "");
  const orArray = splitPreservingQuotes(keywordsOr ? keywordsOr : "");
  const notArray = splitPreservingQuotes(keywordsNot ? keywordsNot : "");

  // Step 1: prepare params
  let queryParams = [];

  const andPart = andArray.length > 0 ? andArray.join(" AND ") : "";
  const orPart = orArray.length > 0 ? `(${orArray.join(" OR ")})` : "";
  // const notPart =
  //   notArray.length > 0 ? notArray.map((k) => `NOT ${k}`).join(" AND ") : "";
  const notPart =
    notArray.length > 0 ? notArray.map((k) => `-${k}`).join(" ") : "";
  const fullQuery = [andPart, orPart, notPart].filter(Boolean).join(" AND ");

  if (fullQuery) {
    queryParams.push(`q=${encodeURIComponent(fullQuery)}`);
  }

  // Always required
  queryParams.push("language=en");
  queryParams.push(`country=us`);
  const requestUrl = `${source.url}search?${queryParams.join("&")}`;

  let requestResponseData = {
    results: [],
    status: "success",
  };
  let newsApiRequestObj = null;
  let xmlText = null;

  console.log("requestUrl: ", requestUrl);

  if (process.env.ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES === "true") {
    try {
      const response = await fetch(requestUrl);
      xmlText = await response.text();
    } catch (parseErr) {
      console.error("❌ XML Parsing Error:", parseErr);
      requestResponseData = {
        status: "error",
        error: parseErr,
      };
    }

    try {
      const result = await parseStringPromise(xmlText);
      const items = result.rss.channel[0].item;
      requestResponseData.results = items.map((item) => {
        return {
          title: item.title?.[0] || null,
          description: item.description?.[0]
            ? item.description[0].match(/<a [^>]*>(.*?)<\/a>/)?.[1] ||
              item.description[0]
            : null,
          publicationDate: item.pubDate?.[0] || null,
          source: item.source?.[0]?._ || null,
          link: item.link?.[0] || null,
          pubDate: item.pubDate?.[0] || null,
        };
      });
      // requestResponseData.status = "ok";
    } catch (parseErr) {
      console.error("❌ XML Parsing Error:", parseErr);
      requestResponseData = {
        status: "error",
        error: parseErr,
        rawXml: xmlText,
      };
    }

    if (requestResponseData.status === "error") {
      // status = "error";
      // console.log(" #1 writeResponseDataFromNewsAggregator");
      writeResponseDataFromNewsAggregator(
        source.id,
        { id: `failed_indexMaster${indexMaster}`, url: requestUrl },
        requestResponseData,
        true
      );
      // await handleErrorNewsDataIoRequest(requestResponseData);

      // This is where we end the process if rate limited
      if (
        requestResponseData.results?.code === "RateLimitExceeded" ||
        requestResponseData.results?.message?.includes("Rate limit exceeded")
      ) {
        console.log(
          `--> ⛔ Ending process: rate limited by ${process.env.NAME_OF_ORG_REQUESTING_FROM}`
        );
        await runSemanticScorer();
        // process.exit(1);
      }
    }
    // newsApiRequestObj = {
    //   url: requestUrl,
    //   andString: keywordsAnd,
    //   orString: keywordsOr,
    //   notString: keywordsNot,
    //   status: requestResponseData.status,
    //   countOfArticlesReceivedFromRequest: requestResponseData.results.length,
    // };

    // Step 4: create new NewsApiRequest
    newsApiRequestObj = await NewsApiRequest.create({
      newsArticleAggregatorSourceId: source.id,
      // dateStartOfRequest: startDate,
      dateEndOfRequest: new Date().toISOString().split("T")[0],
      countOfArticlesReceivedFromRequest: requestResponseData.results?.length,
      // countOfArticlesAvailableFromRequest: requestResponseData.totalResults,
      status: requestResponseData.status,
      url: requestUrl,
      andString: keywordsAnd,
      orString: keywordsOr,
      notString: keywordsNot,
      isFromAutomation: true,
    });
  } else {
    newsApiRequestObj = requestUrl;
  }

  return { requestResponseData, newsApiRequestObj };
}

async function storeNewsApiArticles(requestResponseData, newsApiRequest) {
  // console.log("-----> newsApiRequest ", newsApiRequest);

  // leverages the hasOne association from the NewsArticleAggregatorSource model
  const newsApiSource = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg: process.env.NAME_OF_ORG_REQUESTING_FROM },
    include: [{ model: EntityWhoFoundArticle }],
  });

  const entityWhoFoundArticleId = newsApiSource.EntityWhoFoundArticle?.id;

  try {
    let countOfArticlesSavedToDbFromRequest = 0;
    for (let article of requestResponseData.results) {
      // Append article

      const existingArticle = await Article.findOne({
        where: { url: article.link },
      });
      if (existingArticle) {
        continue;
      }
      const newArticle = await Article.create({
        publicationName: article.source,
        title: article.title,
        // author: article?.creator?.[0],
        description: article.description,
        url: article.link,
        // urlToImage: article.image_url,
        publishedDate: article.pubDate,
        entityWhoFoundArticleId: entityWhoFoundArticleId,
        newsApiRequestId: newsApiRequest.id,
      });

      if (article?.content) {
        // Append ArticleContent
        await ArticleContent.create({
          articleId: newArticle.id,
          content: article.content,
        });
      }
      countOfArticlesSavedToDbFromRequest++;
    }
    // Append NewsApiRequest
    await newsApiRequest.update({
      countOfArticlesSavedToDbFromRequest: countOfArticlesSavedToDbFromRequest,
    });
    // console.log(" #2 writeResponseDataFromNewsAggregator");
    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      newsApiRequest,
      requestResponseData,
      false
      // newsApiRequest.url
    );
  } catch (error) {
    console.error(error);
    requestResponseData.error = error;
    // console.log(" #3 writeResponseDataFromNewsAggregator");
    writeResponseDataFromNewsAggregator(
      newsApiSource.id,
      newsApiRequest,
      requestResponseData,
      true
      // newsApiRequest.url
    );
  }
}

// async function handleErrorNewsDataIoRequest(requestResponseData) {
//   if (
//     Array.isArray(requestResponseData.results?.message) &&
//     typeof requestResponseData.results.message[0]?.message === "string" &&
//     requestResponseData.results.message[0].message.includes(
//       "The domain you provided does not exist"
//     )
//   ) {
//     console.log(
//       "- [makeNewsDataIoRequest] invalid domain: ",
//       requestResponseData.results?.message?.[0]?.invalid_domain
//     );
//     await WebsiteDomain.update(
//       {
//         isArchievedNewsDataIo: true,
//       },
//       {
//         where: {
//           name: requestResponseData.results.message[0].invalid_domain,
//         },
//       }
//     );
//   } else {
//     console.log("Correctly handled invalid_domain with no message 🤩");
//   }

//   if (requestResponseData.results.message[0]?.suggestion) {
//     console.log(
//       "- [makeNewsDataIoRequest] suggestion: ",
//       requestResponseData.results.message[0].suggestion
//     );
//     for (const msg of requestResponseData.results.message) {
//       const invalidDomain = msg.invalid_domain;
//       const suggestions = msg.suggestion;

//       if (invalidDomain) {
//         console.log(
//           "- [makeNewsDataIoRequest] Archiving invalid domain:",
//           invalidDomain
//         );
//         await WebsiteDomain.update(
//           { isArchievedNewsDataIo: true },
//           { where: { name: invalidDomain } }
//         );
//       }

//       if (Array.isArray(suggestions)) {
//         for (const suggestion of suggestions) {
//           try {
//             const websiteDomain = await WebsiteDomain.create({
//               name: suggestion,
//             });
//             console.log(
//               "- [makeNewsDataIoRequest] Added suggestion:",
//               websiteDomain.name
//             );
//           } catch (err) {
//             console.warn(
//               `⚠️ Failed to add suggestion ${suggestion}:`,
//               err.message
//             );
//           }
//         }
//       }
//     }
//   }
// }

module.exports = {
  requester,
};
