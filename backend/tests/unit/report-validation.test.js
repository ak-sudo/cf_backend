const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createReportSchema } = require('../../src/modules/reports/report.validation');
const { ISSUE_CATEGORIES } = require('../../src/constants/reports');

describe('Report Creation Validation Schema Unit Tests', () => {
  it('should accept valid report payload with coordinates and secure images', () => {
    const validData = {
      title: 'Deep dangerous pothole near school',
      description: 'Massive crater in the middle of the road causing traffic congestion and accidents.',
      category: ISSUE_CATEGORIES.POTHOLE,
      coordinates: [77.209, 28.6139], // Delhi [lng, lat]
      images: [
        {
          url: 'https://res.cloudinary.com/civicflow/image/upload/v1234/pothole1.jpg',
          publicId: 'pothole1',
        },
      ],
    };

    const parsed = createReportSchema.safeParse(validData);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.title, validData.title);
  });

  it('should reject coordinates exceeding longitude bounds (-180 to 180)', () => {
    const invalidCoords = {
      title: 'Pothole on main street',
      description: 'Significant road hazard needing repair.',
      coordinates: [195.0, 45.0], // Invalid Longitude > 180
      images: [{ url: 'https://res.cloudinary.com/civicflow/image/upload/v1234/test.jpg' }],
    };

    const parsed = createReportSchema.safeParse(invalidCoords);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /Longitude must be between/);
  });

  it('should reject non-HTTPS image URLs to prevent insecure asset ingestion', () => {
    const insecureImage = {
      title: 'Garbage heap on sidewalk',
      description: 'Solid waste piled up and blocking pedestrians.',
      coordinates: [72.8777, 19.076],
      images: [{ url: 'http://insecure-domain.com/photo.jpg' }],
    };

    const parsed = createReportSchema.safeParse(insecureImage);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /Images must be served over secure HTTPS/);
  });

  it('should reject reports submitted without photos (at least 1 photo required)', () => {
    const noPhotos = {
      title: 'Broken streetlight outside house',
      description: 'Streetlight has been out of order for three days.',
      coordinates: [77.209, 28.6139],
      images: [],
    };

    const parsed = createReportSchema.safeParse(noPhotos);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /At least one verified photo is required/);
  });

  it('should reject reports exceeding maximum 5 photos limit', () => {
    const tooManyPhotos = {
      title: 'Graffiti on community center wall',
      description: 'Vandalism across public building exterior.',
      coordinates: [77.209, 28.6139],
      images: [1, 2, 3, 4, 5, 6].map((i) => ({
        url: `https://res.cloudinary.com/civicflow/photo${i}.jpg`,
      })),
    };

    const parsed = createReportSchema.safeParse(tooManyPhotos);
    assert.equal(parsed.success, false);
    assert.match(parsed.error.errors[0].message, /Maximum of 5 photos allowed/);
  });
});
