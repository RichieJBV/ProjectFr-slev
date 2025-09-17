// Opens and centers the map 
 const map = L.map('map').setView([55.3972, 10.4024], 6);
  
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  // Sets up the empty arrays for the data
    let data = [], markers = [];
    let groupContext = {};
    let currentOverlayIndex = 0;
    const overlaySections = ['birth', 'living', 'group', 'froeslev', 'kz', 'sweden', 'release'];
    let currentPerson = null;
    
    let cityContext = {};
    const arrestBegSet = new Set(); 
    
// Loads the dataset and generic text .json
Promise.all([
  fetch('data/context_texts.json').then(res => res.json()),
  fetch('data/Last_Fr_dataset.csv').then(res => res.text()).then(csv => Papa.parse(csv, { header: true }))
]).then(([cityJson, parsedCsv]) => {

  cityContext = cityJson;
  data = parsedCsv.data;

  const fødebySet = new Set();
  const levebySet = new Set();
  const arrestSet = new Set();

  data.forEach(row => {
    if (row.fødselsby) fødebySet.add(row.fødselsby.trim());
    if (row.leveby) levebySet.add(row.leveby.trim());
    if (row.BegrundelseGroup) arrestSet.add(row.BegrundelseGroup.trim());
  });

  populateDatalist('birth-city-options', fødebySet);
  populateDatalist('living-city-options', levebySet);
  populateDatalist('arrestation-options', arrestSet);

  setupConditionalFilter('birth-city-select', 'birth-city-options');
  setupConditionalFilter('living-city-select', 'living-city-options');
  setupConditionalFilter('arrestation-select', 'arrestation-options');

  setupClearOnClick('birth-city-select');
  setupClearOnClick('living-city-select');
  setupClearOnClick('arrestation-select');
  setupClearOnClick('search-bar');

  document.getElementById('search-bar').addEventListener('input', updateNameOptionsList);
  updateNameOptionsList();
  updateTopTopBar();

}).catch(err => {
  console.error('Error loading resources:', err);
});

// Static coordinates for the overlays.
const staticCoordinates = {
  froeslev: [54.84303, 9.328356],
  kz: [51.1657, 10.4515],
  sweden: [55.602663, 13.000760],
  release: [55.3972, 10.4024]
};
// Clears the markers from the map
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

// Adds the bubbles to the map, based on the filters.
function showBubblesByFilter() {
  clearMarkers();
  updateFilteredOptions();
  updateTopTopBar();

  const fødeby = document.getElementById('birth-city-select').value.toLowerCase().trim();
  const leveby = document.getElementById('living-city-select').value.toLowerCase().trim();
  const arrestFilter = document.getElementById('arrestation-select').value.toLowerCase().trim();

  if (!fødeby && !leveby) return;

  const targetCoords = {};

// allows for the alle to show all markers of the filter
  data.forEach(row => {
    const rowFødeby = row.fødselsby?.toLowerCase().trim() || '';
    const rowLeveby = row.leveby?.toLowerCase().trim() || '';
    const rowArrest = row.BegrundelseGroup?.toLowerCase().trim() || '';

    const fødebyMatch = !fødeby || fødeby === 'alle' || rowFødeby === fødeby;
    const levebyMatch = !leveby || leveby === 'alle' || rowLeveby === leveby;
    const arrestMatch = !arrestFilter || arrestFilter === 'alle' || rowArrest === arrestFilter;

    if ((fødebyMatch || levebyMatch) && arrestMatch) {
      let lat, lon, cityLabel, locationType;

      if (fødeby && (!leveby || leveby === 'alle') && fødebyMatch) {
        lat = parseFloat(row.L_Latitude);
        lon = parseFloat(row.L_Longitude);
        cityLabel = row.leveby || 'Ukendt';
        locationType = 'leveby';
      } else if (leveby && (!fødeby || fødeby === 'alle') && levebyMatch) {
        lat = parseFloat(row.F_Latitude);
        lon = parseFloat(row.F_Longitude);
        cityLabel = row.fødselsby || 'Ukendt';
        locationType = 'fødeby';
      } else if (fødebyMatch && levebyMatch) {
        lat = parseFloat(row.L_Latitude);
        lon = parseFloat(row.L_Longitude);
        cityLabel = row.leveby || 'Ukendt';
        locationType = 'Leveby';
      } else {
        return;
      }


      if (isNaN(lat) || isNaN(lon)) return;

      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (!targetCoords[key]) {
        targetCoords[key] = {
          lat,
          lon,
          city: cityLabel,
          locationType,
          people: []
        };

      }

      targetCoords[key].people.push(row.name || 'Ukendt');
    }
  });

  const group = [];
  Object.values(targetCoords).forEach(loc => {
    const listItems = loc.people.map(person =>
      `<li style="cursor: pointer; color: #007bff; text-decoration: underline;" onclick="showOverlayForName('${person.replace(/'/g, "\\'")}')">${person}</li>`
    ).join('');
// popup for when clicking on dots on the map
const popupContent = `
  <div class="popup-container">
    <div class="popup-line"><strong>By:</strong> ${loc.city.charAt(0).toUpperCase() + loc.city.slice(1)}</div>
    <div class="popup-line"><strong>Antal personer:</strong> ${loc.people.length}</div>
    <div class="popup-list">
      <ul>${listItems}</ul>
    </div>
  </div>
`;

// Controls the placement and style of the dots
    const circle = L.circleMarker([loc.lat, loc.lon], {
      radius: 6 + Math.log2(loc.people.length) * 2.5,
      color: '#a83a37',
      fillColor: '#a83a37',
      fillOpacity: 0.6,
      weight: 7
    }).bindPopup(popupContent);

    circle.addTo(map);
    markers.push(circle);
    group.push(circle);
  });

    if (group.length > 0) {
    map.fitBounds(L.featureGroup(group).getBounds(), { maxZoom: 7 });
    }

}


// Updates and removes filteroption, that would result in an empty or fault on the map as the combinition of filters is not there.
function updateFilteredOptions() {
  const fødebyInput = document.getElementById('birth-city-select').value.toLowerCase().trim();
  const levebyInput = document.getElementById('living-city-select').value.toLowerCase().trim();

  const filteredFødeby = new Set();
  const filteredLeveby = new Set();

  data.forEach(row => {
    const fødeby = row.fødselsby?.trim();
    const leveby = row.leveby?.trim();
    if (!fødeby || !leveby) return;

    if (!levebyInput || leveby.toLowerCase() === levebyInput) {
      filteredFødeby.add(fødeby);
    }
    if (!fødebyInput || fødeby.toLowerCase() === fødebyInput) {
      filteredLeveby.add(leveby);
    }
  });

  populateDatalist('birth-city-options', filteredFødeby);
  populateDatalist('living-city-options', filteredLeveby);
}

function populateDatalist(id, values) {
  const datalist = document.getElementById(id);
  datalist.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'Alle';
  datalist.appendChild(allOption);

  [...values].sort().forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    datalist.appendChild(option);
  });
}

function setupConditionalFilter(inputId, datalistId) {
  const input = document.getElementById(inputId);
  const datalist = document.getElementById(datalistId);

  input.addEventListener('change', () => {
    updateTopTopBar();
    updateFilteredOptions();
    showBubblesByFilter();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      updateTopTopBar();
      updateFilteredOptions();
      showBubblesByFilter();
    }
  });
}
 
// Updates the name options based on the input in the search bar
function updateNameOptionsList() {
  const searchQuery = document.getElementById('search-bar').value.toLowerCase().trim();
  const fødeby = document.getElementById('birth-city-select').value.toLowerCase().trim();
  const leveby = document.getElementById('living-city-select').value.toLowerCase().trim();
  const arrest = document.getElementById('arrestation-select').value.toLowerCase().trim();
  const optionsList = document.getElementById('name-options');
  optionsList.innerHTML = '';

  const filteredRows = data.filter(row => {
    const rowName = row.name?.toLowerCase() || '';
    const rowFødselsdag = row['Fødselsdag']?.toLowerCase() || '';
    const rowFødeby = row.fødselsby?.toLowerCase() || '';
    const rowLeveby = row.leveby?.toLowerCase() || '';
    const rowKZ = row['Afgang til KZ']?.toLowerCase() || '';
    const rowArrest = row.BegrundelseGroup?.toLowerCase() || '';

    const matchesSearch = !searchQuery || 
      rowName.includes(searchQuery) || 
      rowFødselsdag.includes(searchQuery) || 
      rowFødeby.includes(searchQuery) || 
      rowLeveby.includes(searchQuery) || 
      rowKZ.includes(searchQuery);

    const matchesFilters = 
      (!fødeby || fødeby === 'alle' || rowFødeby === fødeby) &&
      (!leveby || leveby === 'alle' || rowLeveby === leveby) &&
      (!arrest || arrest === 'alle' || rowArrest === arrest);

    return matchesSearch && matchesFilters;
  });

  if (filteredRows.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Ingen resultater fundet';
    optionsList.appendChild(li);
  } else {
    filteredRows.forEach(row => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${row.name || 'Ukendt'}</strong> – ${(row.fødselsby ? row.fødselsby.charAt(0).toUpperCase() + row.fødselsby.slice(1) : 'Ukendt')}`;
      li.onclick = () => {
        document.getElementById('search-bar').value = row.name;
        showOverlayForName(row.name);
      };
      optionsList.appendChild(li);
    });
  }
}

  
  function showOverlayForName(name, startSection = 'birth') {
    const normalizedName = (name || '').trim().toLowerCase();
    const matches = data.filter(row =>
      (row.name || '').trim().toLowerCase() === normalizedName
    );
    console.log("Matches found:", matches.length, "for name:", name);
  
    currentPerson = matches[0];
    if (!currentPerson) {
      console.warn("No match for name:", name);
      return;
    }
currentOverlayIndex = overlaySections.indexOf(startSection);
document.getElementById('fullscreen-backdrop').style.display = 'block';
document.getElementById('fullscreen-overlay').style.display = 'block';

// Wait for the overlay to be visible before rendering the map, as it tended to be buggy on first startup and birth is always the first
setTimeout(() => {
  renderOverlaySection();
}, 50); // 


  }
// Skips kz or sweden if the data point is empty
function shouldSkipSection(index) {
  const type = overlaySections[index];
  const dateLabelMap = {
    kz: 'Afgang til KZ',
    sweden: 'Til Sverige'
  };

  if ((type === 'kz' || type === 'sweden')) {
    const label = dateLabelMap[type];
    const value = currentPerson[label];
    return !value || value.trim() === '';
  }

  return false;
}
// List of the btn, which controls the overlays 
function showNext() {
  let nextIndex = currentOverlayIndex + 1;
  while (
    nextIndex < overlaySections.length &&
    shouldSkipSection(nextIndex)
  ) {
    nextIndex++;
  }

  if (nextIndex < overlaySections.length) {
    currentOverlayIndex = nextIndex;
    renderOverlaySection();
  }
}

function showPrevious() {
  let prevIndex = currentOverlayIndex - 1;
  while (
    prevIndex >= 0 &&
    shouldSkipSection(prevIndex)
  ) {
    prevIndex--;
  }

  if (prevIndex >= 0) {
    currentOverlayIndex = prevIndex;
    renderOverlaySection();
  }
}

// The thrid elements the overlay section
function renderOverlaySection() {
  document.getElementById('overlay-text')?.scrollTo({ top: 0, behavior: 'smooth' });


  const type = overlaySections[currentOverlayIndex];
  const titleElem = document.getElementById('overlay-title');
  const textElem = document.getElementById('overlay-text');

  let ctx, lat, lon;
  const undertitleList = [];

  textElem.classList.remove('fullscreen');

  if (type === 'birth') {
    titleElem.textContent = `${currentPerson.fødselsby} før besættelsen`;
    const regionKey = (currentPerson.F_region || 'Ukendt').toLowerCase().trim();
    ctx = getCityContext(regionKey, 'pre');
    lat = parseFloat(currentPerson.F_Latitude);
    lon = parseFloat(currentPerson.F_Longitude);

  } else if (type === 'living') {
    titleElem.textContent = `${currentPerson.leveby} under besættelsen`;
    const regionKey = (currentPerson.L_region || '').toLowerCase().trim();
    ctx = getCityContext(regionKey, 'during');
    lat = parseFloat(currentPerson.L_Latitude);
    lon = parseFloat(currentPerson.L_Longitude);

  } else if (type === 'group') {
    titleElem.textContent = `${currentPerson.name} deltog under besættelsen med ${currentPerson.BegrundelseGroup}`;
    const groupKey = (currentPerson.BegrundelseGroup || 'Ukendt').toLowerCase().trim();
    ctx = getCityContext(groupKey, 'BegrundelseGroup');
    lat = parseFloat(currentPerson.L_Latitude);
    lon = parseFloat(currentPerson.L_Longitude);

  } else if (['froeslev', 'kz', 'sweden', 'release'].includes(type)) {
    const dateLabelMap = {
      froeslev: 'Ankomst til Frøslevlejren',
      kz: 'Afgang til KZ',
      sweden: 'Til Sverige',
      release: 'Løsladt'
    };

    const label = dateLabelMap[type];
    const dateText = currentPerson[label] || 'Ukendt';
    titleElem.textContent = `${label} for ${currentPerson.name}`;
    ctx = getCityContext(type, 'transit');
    if (type === 'release') {
      lat = parseFloat(currentPerson.L_Latitude);
      lon = parseFloat(currentPerson.L_Longitude);
    } else {
      [lat, lon] = staticCoordinates[type];
    }
  }


  // Clear and readying for a new slideshow
  clearInterval(window.slideshowInterval);
  textElem.classList.remove('fullscreen');

  const oldPrev = document.getElementById('prev-slide');
  const oldNext = document.getElementById('next-slide');
  if (oldPrev) oldPrev.remove();
  if (oldNext) oldNext.remove();

  //Imports the images and the images description from the city_context.json
  const imageList = Array.isArray(ctx.images)
  ? ctx.images.map(img => typeof img === 'string' ? { src: img, caption: '' } : img)
  : (ctx.image ? [{ src: ctx.image, caption: '' }] : [{ src: 'fallback.jpg', caption: '' }]);


  // Build undertitleList with proper structure
  if (type === 'birth') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Fødselsdag: ${currentPerson.Fødselsdag || 'Ukendt'}<br>Fødeby: ${currentPerson.fødselsby || 'Ukendt'}</div>`);
  } else if (type === 'living') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Hjemby ved Arrestation: ${currentPerson.leveby || 'Ukendt'}<br>Erhverv: ${currentPerson.erhverv || 'Ukendt'}</div>`);
  } else if (type === 'group') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Arrestationsgrundlag: ${currentPerson.Arrestationsgrundlag || 'Ukendt'}<br>Begrundelse: ${currentPerson.Begrundelse || 'Ukendt'}<br>Arresteret: ${currentPerson.Arresteret || 'Ukendt'}</div>`);
  } else if (type === 'froeslev') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Ankomst til Frøslevlejren: ${currentPerson["Ankomst til Frøslevlejren"] || 'Ukendt'}</div>`);
  } else if (type === 'kz') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Afgang til KZ: ${currentPerson["Afgang til KZ"] || 'Ukendt'}</div>`);
  } else if (type === 'sweden') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Til Sverige: ${currentPerson["Til Sverige"] || 'Ukendt'}</div>`);
  } else if (type === 'release') {
    undertitleList.push(`<div class="overlay-undertitle"><strong>${currentPerson.name || 'Ukendt'}</strong></div>`);
    undertitleList.push(`<div class="overlay-undertitle">Løsladt: ${currentPerson["Løsladt"] || 'Ukendt'}</div>`);
  }

const html = `
  <div class="overlay-inner-wrapper">
    <div class="undertitle-grid">
      ${undertitleList.join('')}
    </div>
    <div class="overlay-content-flex">
      <div class="overlay-image-column">
        <div class="slideshow-wrapper">
          <img id="slideshow-image" class="slideshow-image" src="${imageList[0].src}" alt="${ctx.title}" />
          <div class="slideshow-controls">
            <button id="prev-slide" class="slide-btn prev-slide">❮</button>
            <button id="next-slide" class="slide-btn next-slide">❯</button>
          </div>
          <div id="slideshow-caption" class="slideshow-caption">${imageList[0].caption || ''}</div>
        </div>
      </div>
      <div class="overlay-text-column">
        <h3>${ctx.title}</h3>
        ${(ctx.text || []).map(p => `<p>${p}</p>`).join('')}
        <p><a href="${ctx.source}" target="_blank" rel="noopener noreferrer">Kilde</a></p>
      </div>
      <div id="inline-map-container" class="overlay-map-column"></div>
    </div>
  </div>
`;



  textElem.innerHTML = html;

  // Slideshow functionality
  let currentSlideIndex = 0;
  const imgElement = document.getElementById('slideshow-image');
  const captionElem = document.getElementById('slideshow-caption');
  const prevBtn = document.getElementById('prev-slide');
  const nextBtn = document.getElementById('next-slide');

  prevBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex - 1 + imageList.length) % imageList.length;
    imgElement.src = imageList[currentSlideIndex].src;
    captionElem.textContent = imageList[currentSlideIndex].caption || '';
  });

  nextBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex + 1) % imageList.length;
    imgElement.src = imageList[currentSlideIndex].src;
    captionElem.textContent = imageList[currentSlideIndex].caption || '';
  });

  window.slideshowInterval = setInterval(() => {
    currentSlideIndex = (currentSlideIndex + 1) % imageList.length;
    imgElement.src = imageList[currentSlideIndex].src;
    captionElem.textContent = imageList[currentSlideIndex].caption || '';
  }, 5000);


  // Overlay map
  if (!isNaN(lat) && !isNaN(lon)) {
    const mapContainer = document.getElementById('inline-map-container');
    mapContainer.innerHTML = '';
    const localMap = L.map(mapContainer).setView([lat, lon], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(localMap);
    L.circleMarker([lat, lon], {
      radius: 7,
      color: '#a83a37',
      fillColor: '#a83a37',
      fillOpacity: 0.8,
      weight: 2
    }).addTo(localMap);

    setTimeout(() => {
      localMap.invalidateSize();
    }, 30); // Allows for the overlay to render before adding the map, is done to prevent bugs where the map tiles does not load  
  }
  // Updates the nav btns states
const prevBtnNav = document.querySelector('.nav-btn-fixed button:nth-child(1)');
const nextBtnNav = document.querySelector('.nav-btn-fixed button:nth-child(2)');

const isFirstSection = currentOverlayIndex === 0 || overlaySections[currentOverlayIndex] === 'birth';
const isLastSection = currentOverlayIndex === overlaySections.length - 1 || overlaySections[currentOverlayIndex] === 'release';

if (isFirstSection) {
  prevBtnNav.classList.add('disabled');
} else {
  prevBtnNav.classList.remove('disabled');
}

if (isLastSection) {
  nextBtnNav.classList.add('disabled');
} else {
  nextBtnNav.classList.remove('disabled');
}
}


// Finds and loads the data 
function getCityContext(regionKey, period) {
  try {
    return (
      cityContext?.[period]?.[regionKey] ||
      cityContext?.[period]?.['default'] || // Failsafe if it can't find the region
      {
        title: "Ukendt område",
        text: ["Ingen beskrivelse tilgængelig."],
        images: ["illegalePresse.jpg"],
        source: "#"
      }
    );
  } catch (e) { //Another Failsafe, its better to show something than to break the application
    console.warn("Fejl ved hentning af kontekst:", e);
    return {
      title: "Ukendt område",
      text: ["Ingen beskrivelse tilgængelig."],
      images: ["illegalePresse.jpg"],
      source: "#"
    };
  }
} 
// Filling a filter
  function setupConditionalFilter(inputId, datalistId) {
  const input = document.getElementById(inputId);
  const datalist = document.getElementById(datalistId);
// updates the top-top-bar text and the bubbbles on the map
  input.addEventListener('change', () => {
    updateTopTopBar();
    showBubblesByFilter();
  });
// allows for enter keyword, done in preparation of the touchscreen interaction 
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      updateTopTopBar();
      showBubblesByFilter();
    }
  });
}
// same as the above is used to kick start event chains and update information
function setupClearOnClick(inputId) {
  const input = document.getElementById(inputId);

  input.addEventListener('click', () => {
    if (input.value !== '') {
      input.value = '';
      updateTopTopBar();
      updateFilteredOptions();
      showBubblesByFilter();
    }
  });
  // Clicking on a filter will clear it. This is done in prepration for the Tocuhscreen interaction
  document.getElementById('clear-filters').addEventListener('click', () => {
  location.reload();
  });


  input.addEventListener('input', () => {
    if (input.value === '') {
      updateTopTopBar();
      updateFilteredOptions();
      showBubblesByFilter();
    }
  });
}
        
      function closeOverlay() {
        document.getElementById('fullscreen-backdrop').style.display = 'none';
        document.getElementById('fullscreen-overlay').style.display = 'none';
        currentPerson = null;
        currentOverlayIndex = 0;
      }
      // The top-top bars texts to show the user what is filtering and how
      function updateTopTopBar() {
        const fødeby = document.getElementById('birth-city-select').value.trim();
        const leveby = document.getElementById('living-city-select').value.trim();
        const desc = document.getElementById('filter-description');

        if (fødeby && leveby) {
          desc.textContent = `Personer født i ${fødeby}, der havde hjemby i ${leveby} ved arrestation`;
        } else if (fødeby) {
          desc.textContent = `Personer født i ${fødeby} havde hjemby i ved arrestation...`;
        } else if (leveby) {
          desc.textContent = `Personer med hjemby ved arrestation i ${leveby} blev født i...`;
        } else {
          desc.textContent = `Vælg filter...`;
        }
      }
