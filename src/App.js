import React, { useState, useMemo } from 'react';

// --- STYLES (Modern Dark Theme) ---
const styles = {
  container: {
    backgroundColor: '#0f0f0f',
    color: '#e0e0e0',
    minHeight: '100vh',
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    padding: '40px 0',
    borderBottom: '1px solid #333',
    marginBottom: '30px',
  },
  goldText: {
    color: '#d4af37', // Classic Gold
    textTransform: 'uppercase',
    letterSpacing: '3px',
    fontSize: '2.5rem',
    margin: '0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a2a',
    transition: 'transform 0.2s, border-color 0.2s',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  price: {
    color: '#d4af37',
    fontWeight: 'bold',
    fontSize: '1.2rem',
  },
  button: {
    backgroundColor: '#d4af37',
    color: '#000',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '15px',
    width: '100%',
  },
  bookingBar: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1a1a1a',
    padding: '15px 30px',
    borderRadius: '50px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    border: '1px solid #d4af37',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    width: '90%',
    maxWidth: '500px',
    zIndex: 1000,
  }
};

// --- DATA (The Barber Services) ---
const SERVICES = [
  { id: 1, name: 'Executive Haircut', price: 15000, desc: 'Precision cut, wash, and style.' },
  { id: 2, name: 'Beard Sculpture', price: 10000, desc: 'Hot towel, razor edge, and oil treatment.' },
  { id: 3, name: 'Royal Grooming', price: 25000, desc: 'Haircut + Beard + Gold Face Mask.' },
  { id: 4, name: 'Skin Fade Special', price: 12000, desc: 'Ultra-clean taper or skin fade.' },
  { id: 5, name: 'Kids Haircut', price: 8000, desc: 'Quick & cool styles for the young kings.' },
  { id: 6, name: 'Charcoal Face Mask', price: 5000, desc: 'Deep pore cleansing and steam.' },
];

function App() {
  const [cart, setCart] = useState([]);

  // Logic: Add service to booking
  const toggleService = (service) => {
    if (cart.find(item => item.id === service.id)) {
      setCart(cart.filter(item => item.id !== service.id));
    } else {
      setCart([...cart, service]);
    }
  };

  // Calculate Total
  const totalPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  // WhatsApp Integration
  const sendWhatsApp = () => {
    const message = `Assalamu Alaikum! I want to book: ${cart.map(i => i.name).join(', ')}. Total: ${totalPrice} IQD.`;
    const phone = "9647800000000"; // Replace with actual Barber phone
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.goldText}>Al-Mansour Grooming</h1>
        <p style={{ color: '#888' }}>Premium Barbering & Spa • Karbala</p>
      </header>

      <div style={styles.grid}>
        {SERVICES.map((service) => {
          const isSelected = cart.find(item => item.id === service.id);
          return (
            <div 
              key={service.id} 
              style={{...styles.card, borderColor: isSelected ? '#d4af37' : '#2a2a2a'}}
              onClick={() => toggleService(service)}
            >
              <div>
                <h3 style={{ margin: '0 0 10px 0' }}>{service.name}</h3>
                <p style={{ fontSize: '0.9rem', color: '#888', margin: '0 0 15px 0' }}>{service.desc}</p>
              </div>
              <div style={styles.price}>{service.price.toLocaleString()} IQD</div>
              <button style={{
                ...styles.button, 
                backgroundColor: isSelected ? '#333' : '#d4af37',
                color: isSelected ? '#fff' : '#000'
              }}>
                {isSelected ? 'Remove' : 'Add to Booking'}
              </button>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div style={styles.bookingBar}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>Total Selected</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{totalPrice.toLocaleString()} IQD</div>
          </div>
          <button onClick={sendWhatsApp} style={{...styles.button, marginTop: 0, width: 'auto', padding: '10px 20px'}}>
            Confirm via WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

export default App;