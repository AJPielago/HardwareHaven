import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useResponsive } from '../../utils/responsive';
import BrandMark from '../../components/branding/BrandMark';
import { brand } from '../../theme/brandTheme';

export default function LandingScreen({ navigation, route }) {
  const { isDesktop } = useResponsive();
  const fromHome = Boolean(route?.params?.fromHome);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.heroSection, isDesktop && styles.heroSectionDesktop]}>
        <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
            Hardware Haven
          </Text>
          <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
            Built for Builders, Makers, and Pros
          </Text>
          <Text style={[styles.description, isDesktop && styles.descriptionDesktop]}>
            Find dependable tools, heavy-duty essentials, and trusted hardware brands with fast checkout and real-time order updates.
          </Text>
          
          {!fromHome ? (
            <View style={[styles.buttonContainer, isDesktop && styles.buttonContainerDesktop]}>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('Login')}
                style={[styles.button, styles.loginButton]}
                labelStyle={[styles.buttonLabel, styles.loginButtonLabel]}
                buttonColor={brand.colors.primary}
              >
                Sign In
              </Button>
              <Button
                mode="outlined"
                onPress={() => navigation.navigate('Register')}
                style={[styles.button, styles.registerButton]}
                labelStyle={[styles.buttonLabel, styles.registerButtonLabel]}
                textColor={brand.colors.navy}
              >
                Create Account
              </Button>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('Products')}
                style={[styles.button, styles.loginButton]}
                labelStyle={[styles.buttonLabel, styles.loginButtonLabel]}
                buttonColor={brand.colors.primary}
              >
                Back to Shop
              </Button>
            </View>
          )}
        </View>
        
        <View style={styles.heroImageContainer}>
          <BrandMark />
        </View>
      </View>

      <View style={[styles.featuresSection, isDesktop && styles.featuresSectionDesktop]}>
        <Text style={[styles.featuresTitle, isDesktop && styles.featuresTitleDesktop]}>
          Why Choose Hardware Haven?
        </Text>
        
        <View style={[styles.featuresGrid, isDesktop && styles.featuresGridDesktop]}>
          <FeatureCard
            icon="🧰"
            title="Tool-First Catalog"
            description="Browse practical categories designed around real jobsite needs"
          />
          <FeatureCard
            icon="📦"
            title="Reliable Delivery"
            description="Track shipments from warehouse prep to doorstep arrival"
          />
          <FeatureCard
            icon="🔔"
            title="Action Alerts"
            description="Get instant notices for order updates and exclusive promos"
          />
          <FeatureCard
            icon="🛠️"
            title="Trusted Reviews"
            description="Learn from verified feedback before committing to your next buy"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2026 Hardware Haven. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

function FeatureCard({ icon, title, description }) {
  const { isDesktop } = useResponsive();
  return (
    <View style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.colors.background,
  },
  contentContainer: {
    flexGrow: 1,
  },

  heroSection: {
    backgroundColor: brand.colors.navy,
    paddingVertical: 44,
    paddingHorizontal: 20,
    minHeight: 460,
  },
  heroSectionDesktop: {
    flexDirection: 'row',
    paddingVertical: 72,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroContentDesktop: {
    alignItems: 'flex-start',
    flex: 1,
    maxWidth: 600,
  },
  heroImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
  },
  titleDesktop: {
    fontSize: 62,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 18,
    color: '#9CB5E7',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitleDesktop: {
    fontSize: 22,
    textAlign: 'left',
  },
  description: {
    fontSize: 15,
    color: '#D8E2FA',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 400,
  },
  descriptionDesktop: {
    fontSize: 16,
    textAlign: 'left',
    maxWidth: 500,
    lineHeight: 24,
  },

  buttonContainer: {
    marginTop: 30,
    gap: 12,
    width: '100%',
    maxWidth: 300,
  },
  buttonContainerDesktop: {
    flexDirection: 'row',
    maxWidth: 400,
    gap: 16,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 7,
  },
  loginButton: {
    backgroundColor: brand.colors.primary,
  },
  loginButtonLabel: {
    color: '#fff',
  },
  registerButton: {
    borderColor: brand.colors.navySoft,
    borderWidth: 2,
    backgroundColor: '#EAF0FC',
  },
  registerButtonLabel: {
    color: brand.colors.navy,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  featuresSection: {
    paddingVertical: 56,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  featuresSectionDesktop: {
    paddingVertical: 70,
    paddingHorizontal: 60,
  },
  featuresTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: brand.colors.navy,
    textAlign: 'center',
    marginBottom: 40,
  },
  featuresTitleDesktop: {
    fontSize: 32,
    marginBottom: 60,
  },
  featuresGrid: {
    gap: 20,
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
  },

  featureCard: {
    backgroundColor: '#F8FAFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE6F7',
  },
  featureCardDesktop: {
    width: '45%',
    maxWidth: 280,
    padding: 32,
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: brand.colors.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: brand.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  footer: {
    backgroundColor: '#EAF0FC',
    paddingVertical: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: brand.colors.textMuted,
  },
});
