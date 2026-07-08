function cleanString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function searchGuests(query, guests) {
  if (!query) return [];
  const cleanQuery = cleanString(query);
  
  // Split query into words to allow matching firstName and lastName in any order
  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return [];
  
  return guests.filter(g => {
    const cleanFirstName = cleanString(g.firstName);
    const cleanLastName = cleanString(g.lastName);
    const cleanFullName = `${cleanFirstName} ${cleanLastName}`;
    
    // Every query word must appear in either the firstName, lastName, or combined fullName
    return queryWords.every(word => 
      cleanFirstName.includes(word) || 
      cleanLastName.includes(word) || 
      cleanFullName.includes(word)
    );
  });
}

module.exports = { searchGuests, cleanString };
