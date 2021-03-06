define(function (require) {
  var _ = require('lodash');
  var Scanner = require('ui/utils/scanner');

  require('plugins/kibana/discover/saved_searches/_saved_search');
  require('ui/notify');

  var module = require('ui/modules').get('discover/saved_searches', [
    'kibana/notify'
  ]);

  // Register this service with the saved object registry so it can be
  // edited by the object editor.
  require('plugins/kibana/settings/saved_object_registry').register({
    service: 'savedSearches',
    title: 'searches'
  });

  module.service('savedSearches', function (Promise, config, kbnIndex, es, createNotifier, SavedSearch, kbnUrl) {
    var scanner = new Scanner(es, {
      index: kbnIndex,
      type: 'search'
    });

    var notify = createNotifier({
      location: 'Saved Searches'
    });

    this.type = SavedSearch.type;
    this.Class = SavedSearch;

    this.loaderProperties = {
      name: 'searches',
      noun: 'Saved Search',
      nouns: 'saved searches'
    };


    this.scanAll = function (queryString, pageSize = 1000) {
      return scanner.scanAndMap(queryString, {
        pageSize,
        docCount: Infinity
      }, (hit) => this.mapHits(hit));
    };


    this.get = function (id) {
      return (new SavedSearch(id)).init();
    };

    this.urlFor = function (id) {
      return kbnUrl.eval('#/discover/{{id}}', {id: id});
    };

    this.delete = function (ids) {
      ids = !_.isArray(ids) ? [ids] : ids;
      return Promise.map(ids, function (id) {
        return (new SavedSearch(id)).delete();
      });
    };

    this.mapHits = function (hit) {
      var source = hit._source;
      source.id = hit._id;
      source.url = this.urlFor(hit._id);
      return source;
    };

    this.find = function (searchString, size = 100) {
      var body;
      if (searchString) {
        body = {
          query: {
            simple_query_string: {
              query: searchString + '*',
              fields: ['title^3', 'description'],
              default_operator: 'AND'
            }
          }
        };
      } else {
        body = { query: {match_all: {}}};
      }

      return es.search({
        index: kbnIndex,
        type: 'search',
        body: body,
        size: size
      })
      .then((resp) => {
        return {
          total: resp.hits.total,
          hits: resp.hits.hits.map((hit) => this.mapHits(hit))
        };
      });
    };
  });
});
