var map;
var markers = [];
var currentCenter = "40.758895,-73.98513100000002";
var largeInfowindow;

function initMap() {
    // Create a new map with centered at "Times Sqaure, NY" initially.
    map = new google.maps.Map($("#map")[0], {
      center: {lat: 40.758895, lng: -73.98513100000002},
      zoom: 15,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        position: google.maps.ControlPosition.TOP_RIGHT
      }
    });

    // Bias the boundaries within the map for the go to area text.
    var zoomAutocomplete = new google.maps.places.Autocomplete(
        $('#go-to-area-text')[0]);
    zoomAutocomplete.bindTo('bounds', map);

    // Initialize the infoWindow.
    largeInfowindow = new google.maps.InfoWindow();
}

// Handle error for google maps api.
function googleMapError() {
  alert("Google Maps Could Not Be Loaded");
}

// Populate the infowindow when the marker is clicked.
// Only allow one infowindow which will open at the marker that is clicked,
// and populate based on that markers position.
function populateInfoWindow(marker, infowindow, restaurant) {
  // Check to make sure the infowindow is not already opened on this marker.
  // Clear the infowindow content to give the streetview time to load.
  // Make sure the marker property is cleared if the infowindow is closed.
  if (infowindow.marker != marker) {
    infowindow.setContent('');
    infowindow.marker = marker;
    infowindow.addListener('closeclick', function() {
      infowindow.marker = null;
    });
    var streetViewService = new google.maps.StreetViewService();
    var radius = 50;

    // In case the status is OK, which means the pano was found, compute the
    // position of the streetview image, then calculate the heading, then get a
    // panorama from that and set the options.
    function getStreetView(data, status) {
      if (status == google.maps.StreetViewStatus.OK) {
        var nearStreetViewLocation = data.location.latLng;
        var heading = google.maps.geometry.spherical.computeHeading(
          nearStreetViewLocation, marker.position);

        // Get the restaurant info from foursquare data.
        var name = restaurant.name;
        var hours = (restaurant.hours!=undefined) ?
                    (restaurant.hours.status!=undefined ? restaurant.hours.status : "") : "";
        var phone = (restaurant.contact!=undefined) ?
                    (restaurant.contact.formattedPhone!=undefined ? restaurant.contact.formattedPhone : "") : "";
        var address = (restaurant.location!=undefined) ?
                    (restaurant.location.address!=undefined ? restaurant.location.address : "") : "";
        var rating = (restaurant.rating!=undefined) ? (restaurant.rating + "/10") : "--";
        var restUrl = (restaurant.url!=undefined) ? (restaurant.url) : "";
        infowindow.setContent('<div><strong>' + name +
                        '</strong></div><div>' + hours +
                        '</div><div>rating: ' + rating +
                        '</div><div>' + phone +
                        '</div><div>' + address +
                        '</div><a href="' + restUrl +
                        '">website</a><div id="pano"></div>' +
                        '<img src="img/Powered-by-Foursquare.png" alt="Powered by Foursquare">');
        var panoramaOptions = {
          position: nearStreetViewLocation,
          pov: {
            heading: heading,
            pitch: 10
          }
        };
        var panorama = new google.maps.StreetViewPanorama(
          $("#pano")[0], panoramaOptions);
      } else {
        infowindow.setContent('<div>' + marker.title + '</div>' +
          '<div>No Street View Found</div>');
      }
    }
    // Use streetview service to get the closest streetview image within
    // 50 meters of the markers position and open the infowindow on the correct marker.
    streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
    infowindow.open(map, marker);
  }
}

// Get the address/area that the user entered and recenter the map.
function goToArea() {
    // Initialize the geocoder.
    // Get the address or place that the user entered.
    // Make sure the address isn't blank.
    var geocoder = new google.maps.Geocoder();
    var address = $("#go-to-area-text").val();
    if (address == '') {
          window.alert('You must enter an area, or address.');
        } else {
          // Geocode the address/area entered to get the center.
          // Offset longitude of the center for "options box".
          // Then, center the map on it and zoom in
          geocoder.geocode(
            { address: address },
            function(results, status) {
              if (status == google.maps.GeocoderStatus.OK) {
                var offsetCenter = {lat: results[0].geometry.location.lat(),
                                    lng: results[0].geometry.location.lng()-0.003};
                map.setCenter(offsetCenter);
                map.setZoom(15);

                // Save the currentCenter for foursquare api usage.
                currentCenter = '';
                currentCenter += results[0].geometry.location.lat() + ','
                                + results[0].geometry.location.lng();
              } else {
                window.alert('We could not find that location - try entering a more' +
                    ' specific place.');
              }
            });
        }
}

// Helper functions.

function setMapOnAll(markers, map) {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

function showMarkers(markers) {
  setMapOnAll(markers, map);
}

function hideMarkers(markers) {
  setMapOnAll(markers, null);
}

function deleteMarkers(markers) {
  hideMarkers(markers);
  markers = [];
}

function showDropdown() {
  $('#drop-down').show();
}

function hideDropdown() {
  $('#drop-down').hide();
}

// Get the current date for the lastest foursquare data.
function getFoursquareVersion() {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1;
  var yyyy = today.getFullYear().toString();
  if ( dd < 10 ) {
    dd = '0' + dd;
  }
  if ( mm < 10 ) {
    mm = '0' + mm;
  }
  return yyyy + mm + dd;
}

// ViewModel for Knockout.
var ViewModel = function() {

    var self = this;

    // Declare observables and observable arrays
    this.currentArea = ko.observable("Times Square, NY");
    this.restList = ko.observableArray([]);
    this.catList = ko.observableArray(['Show All']);
    this.currentFilter = ko.observable('Show All');

    // Get restaurant list, categories list using foursquare api.
    // Generate html elements for each restaurant and each category.
    // Create markers for each restaurant.
    this.getRestList = function() {
      self.restList.removeAll();
      self.catList.splice(1);
      hideMarkers(markers);
      markers = [];
      var v = getFoursquareVersion();
      var FSUrl = "https://api.foursquare.com/v2/venues/explore?";
      FSUrl += $.param({
        'll': currentCenter,
        'client_id': FS.client_id,
        'client_secret': FS.client_secret,
        'section': 'food',
        'radius': '1500',
        'v': v
      });

      // Ajax request.
      $.getJSON(FSUrl, function (data) {
          $.each(data.response.groups[0].items , function(num, i) {

            // Append to the restaurant list.
            self.restList.push(i.venue);

            // Create marker.
            var title = i.venue.name;
            var position = {lat: i.venue.location.lat, lng: i.venue.location.lng};
            var marker = new google.maps.Marker({
              position: position,
              title: title,
              animation: google.maps.Animation.DROP,
              id: i,
              map: map
            });

            markers.push(marker);
            marker.addListener('click', function() {
              populateInfoWindow(this, largeInfowindow, i.venue);
              if (this.getAnimation() != google.maps.Animation.BOUNCE) {
                this.setAnimation(google.maps.Animation.BOUNCE);
                } else {
                this.setAnimation(null);
                }
            });

            // Append to the category list.
            if ( self.catList.indexOf(i.venue.categories[0].shortName) === -1 ) {
                  self.catList.push(i.venue.categories[0].shortName);
                }
              });

          // Show dropdown category list.
          showDropdown();
          // Add click event listener for each restaurant element.
          $('li').click(function() {
              $('li').removeClass('selected');
              $(this).addClass('selected');
          });
          })
        .fail( function( jqxhr, statusText, error) {
          var errText = statusText + ", " + error;
          alert("Foursquare Data Could Not Be Loaded: " + errText);
        });
     }

    // Binding function: Set the current area.
    this.setCurrentArea = function() {
        self.deleteRestList();
        var address = $("#go-to-area-text").val();
        if (address != '') {
          self.currentArea(address);
          goToArea();
        }
    }

    // Binding function: Delete the restaurant list and category list.
    this.deleteRestList = function() {
      hideDropdown();
      deleteMarkers(markers);
      self.restList.removeAll();
      self.catList.splice(1);
    }

    // Binding function: Open infowindow for each restaurant and Set marker animation.
    this.openInfowindow = function(i) {
      var len = markers.length;
      if ( i() < len ) {
        for (var j=0; j<len; j++) {
          markers[j].setAnimation(null);
        };
        populateInfoWindow(markers[i()], largeInfowindow, self.restList()[i()]);
        markers[i()].setAnimation(google.maps.Animation.BOUNCE);
      }
    }

    // Binding function: Set the current filter.
    this.setCurrentFilter = function() {
      var filter = $('select').val();
      self.currentFilter(filter);
      for (var i = 0; i < self.restList().length; i++) {
        if (self.restList()[i].categories[0].shortName != filter) {
          $('li').eq(i).hide();
          markers[i].setMap(null);
        } else {
          $('li').eq(i).show();
          markers[i].setMap(map);
        }
      }
    }

    // Binding function: Clear the current filter.
    this.clearFilter = function() {
      $('select').val("Show All");
      self.currentFilter("Show All");
      $('li').show();
      showMarkers(markers);
    }

    // Binding function: Toggle options box.
    this.toggleOptions = function() {
      $('.options-box').toggle();
    }

    this.getRestList();

}

ko.applyBindings(new ViewModel())
