import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Searchbar, Card, Text, Chip, Button, Menu, IconButton, FAB, Badge } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, fetchCategories } from '../../store/slices/productSlice';
import { getImageUrl } from '../../api/config';
import { useResponsive } from '../../utils/responsive';
import { brand } from '../../theme/brandTheme';

export default function ProductListScreen({ navigation }) {
  const dispatch = useDispatch();
  const { items, loading, categories, total } = useSelector((state) => state.products);
  const { user } = useSelector((state) => state.auth);
  const cartItems = useSelector((state) => state.cart.items);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [sort, setSort] = useState('');
  const [listKey, setListKey] = useState('initial'); // Force re-render key

  const { width: windowWidth, isWeb, isDesktop } = useResponsive();

  const webGridItemStyle = useMemo(() => {
    if (!isWeb) return null;
    if (windowWidth >= 1400) return { width: '25%', padding: 8 };
    if (windowWidth >= 1024) return { width: '33.333%', padding: 8 };
    if (windowWidth >= 600) return { width: '50%', padding: 6 };
    return { width: '100%', maxWidth: 420, alignSelf: 'center', padding: 8 };
  }, [isWeb, windowWidth]);

  const loadProducts = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (selectedCategory) params.category = selectedCategory;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (sort) params.sort = sort;
    dispatch(fetchProducts(params));
  }, [search, selectedCategory, minPrice, maxPrice, sort]);

  const filtersBootstrapped = useRef(false);

  useEffect(() => {
    dispatch(fetchCategories());
    loadProducts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCategories());
      loadProducts();
    }, [dispatch, loadProducts])
  );

  useEffect(() => {
    if (!filtersBootstrapped.current) {
      filtersBootstrapped.current = true;
      return;
    }
    loadProducts();
    // Intentionally omit loadProducts: it changes when `search` changes; we only auto-refetch filters/sort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, selectedCategory, minPrice, maxPrice]);

  // Force re-render after mount on web to fix layout issues
  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        setListKey('mounted');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSearch = () => loadProducts();

  const clearFilters = () => {
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSort('');
    setSearch('');
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const renderProduct = ({ item }) => (
    <Card
      style={[styles.card, isWeb && styles.cardWeb, isDesktop && styles.cardWebDesktop]}
      onPress={() => navigation.navigate('ProductDetail', { id: item._id })}
    >
      {item.image ? (
        <Card.Cover
          source={{ uri: getImageUrl(item.image) }}
          style={[styles.cardImage, isDesktop && styles.cardImageDesktop]}
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <Card.Content style={styles.cardContent}>
        <Text variant="titleMedium" numberOfLines={2} style={styles.productName}>{item.name}</Text>
        <Text variant="bodyLarge" style={styles.price}>₱{item.price.toFixed(2)}</Text>
        <View style={styles.ratingRow}>
          <View style={styles.ratingGroup}>
            <Text style={styles.rating}>★ {item.averageRating.toFixed(1)}</Text>
            <Text style={styles.reviews}>({item.numReviews})</Text>
          </View>
          {!!item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1} ellipsizeMode="tail">
                {item.category}
              </Text>
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('LandingHome', { fromHome: true })}
        style={styles.brandStrip}
      >
        <Text style={styles.brandEyebrow}>WELCOME TO</Text>
        <Text style={styles.brandTitle}>Hardware Haven</Text>
      </TouchableOpacity>

      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          style={styles.searchbar}
        />
        <View style={styles.cartButton}>
          <IconButton
            icon="cart"
            size={24}
            onPress={() => navigation.navigate('Cart')}
          />
          {cartCount > 0 && <Badge style={styles.badge}>{cartCount}</Badge>}
        </View>
      </View>

      <View style={styles.filterRow}>
        <Button mode={showFilters ? 'contained' : 'outlined'} onPress={() => setShowFilters(!showFilters)} compact icon="filter-variant">
          Filters
        </Button>
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={<Button mode="outlined" onPress={() => setSortMenuVisible(true)} compact icon="sort">Sort</Button>}
        >
          <Menu.Item onPress={() => { setSort(''); setSortMenuVisible(false); }} title="Newest" />
          <Menu.Item onPress={() => { setSort('price_asc'); setSortMenuVisible(false); }} title="Price: Low to High" />
          <Menu.Item onPress={() => { setSort('price_desc'); setSortMenuVisible(false); }} title="Price: High to Low" />
          <Menu.Item onPress={() => { setSort('rating'); setSortMenuVisible(false); }} title="Top Rated" />
        </Menu>
        {(selectedCategory || minPrice || maxPrice) && (
          <Button mode="text" onPress={clearFilters} compact textColor={brand.colors.danger}>Clear All</Button>
        )}
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <Text variant="labelLarge" style={{ marginBottom: 8, fontWeight: '600' }}>Filter by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                selected={selectedCategory === cat}
                onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                style={[styles.filterChip, selectedCategory === cat && styles.filterChipSelected]}
                selectedColor="#fff"
              >
                {cat}
              </Chip>
            ))}
          </ScrollView>
          <Text variant="labelLarge" style={{ marginBottom: 8, marginTop: 12, fontWeight: '600' }}>Price Range</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceInput}>
              <Text variant="labelSmall" style={{ marginBottom: 4 }}>Min Price</Text>
              <Searchbar
                placeholder="0"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
                style={styles.priceSearchbar}
                onSubmitEditing={handleSearch}
              />
            </View>
            <Text style={{ alignSelf: 'flex-end', marginBottom: 16, marginHorizontal: 8, color: brand.colors.textMuted }}>-</Text>
            <View style={styles.priceInput}>
              <Text variant="labelSmall" style={{ marginBottom: 4 }}>Max Price</Text>
              <Searchbar
                placeholder="99999"
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
                style={styles.priceSearchbar}
                onSubmitEditing={handleSearch}
              />
            </View>
            <Button mode="contained" onPress={handleSearch} compact style={{ alignSelf: 'flex-end', marginBottom: 10, marginLeft: 8 }} buttonColor={brand.colors.primary}>Apply</Button>
          </View>
        </View>
      )}

      <Text style={styles.resultCount}>{total} product{total !== 1 ? 's' : ''} found</Text>

      {/* Use ScrollView for web (more reliable), FlatList for native */}
      {Platform.OS === 'web' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProducts} />}
        >
          <View style={styles.grid}>
            {items.length === 0 && !loading && <Text style={styles.empty}>No products found</Text>}
            {items.map((item) => (
              <View key={item._id} style={[styles.gridItem, webGridItemStyle]}>
                {renderProduct({ item })}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.listContainer}>
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            renderItem={renderProduct}
            numColumns={2}
            key={listKey}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProducts} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={!loading && <Text style={styles.empty}>No products found</Text>}
            columnWrapperStyle={styles.gridRow}
          />
        </View>
      )}

      {user?.role === 'admin' && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate('ProductForm')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: brand.colors.background,
    ...(Platform.OS === 'web' && {
      height: '100%',
    }),
  },
  brandStrip: {
    backgroundColor: brand.colors.navy,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  brandEyebrow: {
    color: '#9CB5E7',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
    marginTop: 3,
  },
  searchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
    }),
  },
  searchbar: { 
    flex: 1, 
    backgroundColor: '#F1F5FC', 
    borderRadius: 12,
  },
  cartButton: { 
    position: 'relative',
    marginLeft: 8,
  },
  badge: { 
    position: 'absolute', 
    right: -2, 
    top: -2, 
    backgroundColor: brand.colors.primary,
  },
  filterRow: { 
    flexDirection: 'row', 
    paddingHorizontal: 10, 
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff',
  },
  filtersContainer: { 
    paddingHorizontal: 12, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    marginHorizontal: 10, 
    borderRadius: 12, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D6E1F3',
  },
  filterChip: { 
    marginRight: 8, 
    backgroundColor: '#EAF0FC',
  },
  filterChipSelected: { 
    backgroundColor: brand.colors.navy,
  },
  priceRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
  },
  priceInput: { 
    flex: 1,
  },
  priceSearchbar: { 
    height: 40, 
    backgroundColor: '#F1F5FC', 
    borderRadius: 8,
  },
  resultCount: { 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    color: brand.colors.textMuted, 
    fontSize: 12,
  },
  listContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 200px)',
      minHeight: 400,
    }),
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'calc(100vh - 200px)',
      minHeight: 400,
    }),
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  scrollContentDesktop: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxWidth: 1440,
    alignSelf: 'center',
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    padding: 5,
  },
  flatList: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100%',
    }),
  },
  list: { 
    paddingHorizontal: 10, 
    paddingBottom: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  card: { 
    flex: 1,
    margin: 5,
    maxWidth: '48%',
    borderRadius: 12, 
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9E3F5',
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'column',
    }),
  },
  cardWeb: {
    margin: 0,
    maxWidth: '100%',
    width: '100%',
  },
  cardWebDesktop: {
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 12px rgba(26, 26, 46, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.06)',
    }),
  },
  cardImage: { 
    height: 150,
    backgroundColor: '#EAF0FC',
  },
  cardImageDesktop: {
    height: 200,
  },
  placeholderImage: { 
    height: 150, 
    backgroundColor: '#EAF0FC', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  placeholderText: { 
    color: brand.colors.textMuted,
  },
  cardContent: { 
    paddingVertical: 10, 
    paddingHorizontal: 10,
  },
  productName: { 
    fontWeight: '600', 
    color: brand.colors.text,
  },
  price: { 
    color: brand.colors.primary, 
    fontWeight: '700', 
    marginTop: 4, 
    fontSize: 16,
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    justifyContent: 'space-between',
  },
  ratingGroup: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  rating: { 
    color: '#f59e0b', 
    fontSize: 13, 
    fontWeight: '600',
  },
  reviews: { 
    color: brand.colors.textMuted, 
    fontSize: 12, 
    marginLeft: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#EAF0FC',
  },
  categoryText: { 
    fontSize: 11, 
    color: brand.colors.navy, 
    fontWeight: '500',
  },
  empty: { 
    textAlign: 'center', 
    marginTop: 50, 
    color: brand.colors.textMuted, 
    fontSize: 16,
    width: '100%',
  },
  fab: { 
    position: 'absolute', 
    right: 16, 
    bottom: 16, 
    backgroundColor: brand.colors.primary, 
    borderRadius: 16,
  },
});
