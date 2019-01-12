var map;
var markers = [];
var currentCenter = "40.758895,-73.98513100000002";
var largeInfowindow;
var zoomAutocomplete;

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
    zoomAutocomplete = new google.maps.places.Autocomplete(
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
function populateInfoWindow(marker, infowindow, venue) {
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
        var name = venue.name;
        var hours = venue.hours ?
                    (venue.hours.status ? venue.hours.status : "") : "";
        var phone = venue.contact ?
                    (venue.contact.formattedPhone ? venue.contact.formattedPhone : "") : "";
        var address = venue.location ?
                    (venue.location.address ? venue.location.address : "") : "";
        var rating = venue.rating ? (venue.rating + "/10") : "--";
        var restUrl = venue.url ? venue.url : "";
        infowindow.setContent('<div><strong>' + name +
                        '</strong></div><div>' + hours +
                        '</div><div>rating: ' + rating +
                        '</div><div>' + phone +
                        '</div><div>' + address +
                        '</div><a href="' + restUrl +
                        '" target="_blank">website</a><div id="pano"></div>' +
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

// Helper functions.

function setMapOnAll(markers, map) {
  for (let i = 0; i < markers.length; i++) {
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
    this.venueList = ko.observableArray([]);
    this.catList = ko.observableArray(['Show All']);
    this.currentFilter = ko.observable('Show All');
    this.optionsVisible = ko.observable(true);
    this.selectedIndex = ko.observable(100);
    this.sectionList = ko.observableArray(
      ['food','drinks','coffee','shops','arts','outdoors','sights','trending']);
    this.currentSection = ko.observable('food');

    // Get venue list, categories list using foursquare api.
    // Generate html elements for each venue and each category.
    // Create markers for each venue.
    this.getVenueList = function() {
      self.venueList.removeAll();
      self.catList.splice(1);
      hideMarkers(markers);
      markers = [];
      var v = getFoursquareVersion();
      var FSUrlExp = "https://api.foursquare.com/v2/venues/explore?";
      FSUrlExp += $.param({
        'll': currentCenter,
        'client_id': FS.client_id,
        'client_secret': FS.client_secret,
        'section': self.currentSection(),
        'radius': '1500',
        'v': v
      });

      // Ajax request.
      $.getJSON(FSUrlExp, function (data) {
          $.each(data.response.groups[0].items , function(num, i) {

            // Append to the venue list.
            self.venueList.push(i.venue);

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
            
	    // Get more detailed info for the venue
            var curVenue;
	    var FSUrlVenue = "https://api.foursquare.com/v2/venues/"+i.venue.id+"?";
	    FSUrlVenue += $.param({
	      'client_id': FS.client_id,
	      'client_secret': FS.client_secret,
	      'v': v
	    });
	    $.getJSON(FSUrlVenue, function(fsVenueResponse) {
	      curVenue = fsVenueResponse.response.venue
	    });

            markers.push(marker);
            marker.addListener('click', function() {
              populateInfoWindow(this, largeInfowindow, curVenue);
              for (let j=0; j<markers.length; j++) {
                markers[j].setAnimation(null);
                };
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
          })
        .fail( function( jqxhr, statusText, error) {
          var errText = statusText + ", " + error;
          alert("Foursquare Data Could Not Be Loaded: " + errText);
        });
     }

    // Get the address/area that the user entered and recenter the map.
    this.goToArea = function() {
        // Initialize the geocoder.
        // Get the address or place that the user entered.
        // Make sure the address isn't blank.
        var geocoder = new google.maps.Geocoder();
        var address = self.currentArea()
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

    // Binding function: Set the current area.
    this.setCurrentArea = function() {
        self.deleteVenueList();
        self.currentArea(zoomAutocomplete.getPlace().formatted_address);
        self.goToArea();
    }

    // Binding function: Delete the venue list and category list.
    this.deleteVenueList = function() {
      deleteMarkers(markers);
      self.venueList.removeAll();
      self.catList.splice(1);
    }

    // Binding function: Open infowindow for each selected venue, set marker animation, and update selectedIndex variable for css binding function, isSelected().
    this.selectVenue = function(i) {
      self.selectedIndex(i());
      if ( i() < markers.length ) {
        for (let j=0; j<markers.length; j++) {
          markers[j].setAnimation(null);
        };
        populateInfoWindow(markers[i()], largeInfowindow, self.venueList()[i()]);
        markers[i()].setAnimation(google.maps.Animation.BOUNCE);
      }
    }

    // Binding function: For visible binding of filtered items.
    this.isfiltered = function(i) {
      if ((self.currentFilter() === "Show All") || (self.currentFilter() === self.venueList()[i()].categories[0].shortName)) { return true }
      else { return false }
    }

    // Binding function: Set the current filter.
    this.setCurrentFilter = function() {
      for (let i = 0; i < self.venueList().length; i++) {
        if (self.venueList()[i].categories[0].shortName != self.currentFilter()) {
          markers[i].setMap(null);
        } else {
          markers[i].setMap(map);
        }
      }
    }

    // Binding function: Clear the current filter.
    this.clearFilter = function() {
      self.currentFilter("Show All");
      showMarkers(markers);
    }

    // Binding function: Toggle options box.
    this.toggleOptions = function() {
      if (self.optionsVisible() != true) {self.optionsVisible(true);}
        else {self.optionsVisible(false);}
    }

    // Binding function: For visible binding to dropdown menu.
    this.isVenueList = function() {
      if (self.venueList().length > 0) { return true }
        else { return false }
    }

    // Binding function: For css binding to li tags.
    this.isSelected = function(i) {
      if (i()===self.selectedIndex()) {return true}
        else {return false}
    }

    self.getVenueList();

}

ko.applyBindings(new ViewModel())
